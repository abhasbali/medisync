import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useRealtime } from "@/contexts/RealtimeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useHospitals } from "@/hooks/queries";
import { api } from "@/services/api";
import { RESOURCE_LABELS, availabilityLevel } from "@/lib/format";

export type AlertLevel = "critical" | "warning" | "info";

export interface AppAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  at: number;
  read: boolean;
}

interface AlertsState {
  alerts: AppAlert[];
  unread: number;
  markAllRead: () => void;
  clear: () => void;
  sound: boolean;
  setSound: (on: boolean) => void;
}

const AlertsContext = createContext<AlertsState | null>(null);

export function useAlerts(): AlertsState {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertsProvider");
  return ctx;
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio unavailable */
  }
}

const SOUND_KEY = "medisync.alertSound";

/**
 * Turns realtime events into operator alerts:
 *  - a CRITICAL patient enters the queue
 *  - a transfer request arrives for the user's hospital (admins see all)
 *  - a hospital resource drops into the critical band (< 15% free); staff only for their own hospital
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { lastEvent } = useRealtime();
  const { user } = useAuth();
  const hospitals = useHospitals();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [sound, setSoundState] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) === "1";
    } catch {
      return false;
    }
  });
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const push = (level: AlertLevel, title: string, detail: string) => {
    setAlerts((list) =>
      [{ id: `${Date.now()}-${Math.random()}`, level, title, detail, at: Date.now(), read: false }, ...list].slice(0, 30),
    );
    const fn = level === "critical" ? toast.error : level === "warning" ? toast.warning : toast.info;
    fn(title, { description: detail, duration: level === "critical" ? 10000 : 6000 });
    if (soundRef.current && level !== "info") beep();
  };
  const pushRef = useRef(push);
  pushRef.current = push;

  // Event-driven alerts.
  useEffect(() => {
    if (!lastEvent || !user || lastEvent.referenceId == null) return;
    const id = lastEvent.referenceId;
    if (lastEvent.type === "QUEUED") {
      api
        .request(id)
        .then((r) => {
          if (r.severity === "CRITICAL" && r.status === "PENDING") {
            pushRef.current(
              "critical",
              "Critical patient waiting",
              `${r.patientName} (#${r.id}) needs ${RESOURCE_LABELS[r.resourceType]} - no bed free in the network.`,
            );
          }
        })
        .catch(() => {});
    } else if (lastEvent.type === "TRANSFER_REQUESTED") {
      api
        .transfer(id)
        .then((t) => {
          if (user.role === "ADMIN" || user.hospitalId === t.donorHospitalId) {
            pushRef.current(
              "warning",
              "Transfer request awaiting decision",
              `${t.requesterHospitalName} requests ${t.quantity} × ${RESOURCE_LABELS[t.resourceType]} from ${t.donorHospitalName}.`,
            );
          }
        })
        .catch(() => {});
    }
  }, [lastEvent, user]);

  // Capacity threshold alerts: fire when a row crosses into the critical band.
  const prevLevels = useRef<Map<number, string> | null>(null);
  useEffect(() => {
    const data = hospitals.data;
    if (!data || !user) return;
    const next = new Map<number, string>();
    for (const h of data) {
      for (const row of h.inventory) {
        const level = availabilityLevel(row.available, row.total);
        next.set(row.id, level);
        const before = prevLevels.current?.get(row.id);
        const relevant = user.role !== "HOSPITAL_STAFF" || user.hospitalId === h.id;
        if (prevLevels.current && relevant && level === "critical" && before && before !== "critical") {
          pushRef.current(
            "critical",
            `${h.name}: ${RESOURCE_LABELS[row.resourceType]} critical`,
            `Only ${row.available} of ${row.total} units free.`,
          );
        }
      }
    }
    prevLevels.current = next; // first load only establishes the baseline
  }, [hospitals.data, user]);

  const setSound = (on: boolean) => {
    setSoundState(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (on) beep();
  };

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        unread: alerts.filter((a) => !a.read).length,
        markAllRead: () => setAlerts((l) => l.map((a) => ({ ...a, read: true }))),
        clear: () => setAlerts([]),
        sound,
        setSound,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}
