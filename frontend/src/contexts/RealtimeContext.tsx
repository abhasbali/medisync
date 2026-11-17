import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Client, type IMessage } from "@stomp/stompjs";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { keys } from "@/hooks/queries";
import type { UpdateMessage } from "@/types/api";

export type ConnectionStatus = "live" | "reconnecting" | "offline";

interface RealtimeState {
  status: ConnectionStatus;
  lastEventAt: number | null;
  lastEvent: UpdateMessage | null;
}

const RealtimeContext = createContext<RealtimeState>({ status: "offline", lastEventAt: null, lastEvent: null });

export function useRealtime() {
  return useContext(RealtimeContext);
}

/** ws://host/ws through the Vite proxy in development, or VITE_WS_URL when set. */
function brokerUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return configured;
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

/** Invalidate only the data affected by an event (everything that shows counts depends on inventory). */
export function invalidateFor(qc: QueryClient, msg: UpdateMessage) {
  qc.invalidateQueries({ queryKey: keys.activity });
  qc.invalidateQueries({ queryKey: keys.stats });
  if (msg.entity === "TRANSFER") {
    qc.invalidateQueries({ queryKey: keys.transfers });
  }
  if (msg.type !== "TRANSFER_REQUESTED" && msg.type !== "TRANSFER_REJECTED") {
    // Allocations, releases, edits and approvals change inventory and possibly the queue.
    qc.invalidateQueries({ queryKey: keys.hospitals });
    qc.invalidateQueries({ queryKey: keys.inventory });
    qc.invalidateQueries({ queryKey: keys.requests });
  }
}

/**
 * Maintains one STOMP connection to /ws, subscribes to /topic/updates and turns each committed
 * change into TanStack Query invalidations. On every (re)connect all data is reloaded, so a window
 * that was offline cannot keep showing stale numbers.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<RealtimeState>({ status: "reconnecting", lastEventAt: null, lastEvent: null });
  const everConnected = useRef(false);

  useEffect(() => {
    const client = new Client({
      brokerURL: brokerUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
    });

    client.onConnect = () => {
      setState((s) => ({ ...s, status: "live" }));
      client.subscribe("/topic/updates", (frame: IMessage) => {
        try {
          const msg = JSON.parse(frame.body) as UpdateMessage;
          invalidateFor(qc, msg);
          setState((s) => ({ ...s, lastEventAt: Date.now(), lastEvent: msg }));
        } catch {
          qc.invalidateQueries();
        }
      });
      if (everConnected.current) {
        qc.invalidateQueries(); // resync after a reconnect
      }
      everConnected.current = true;
    };

    const lost = () => setState((s) => ({ ...s, status: navigator.onLine ? "reconnecting" : "offline" }));
    client.onWebSocketClose = lost;
    client.onStompError = lost;
    client.onWebSocketError = lost;

    const goOffline = () => setState((s) => ({ ...s, status: "offline" }));
    const goOnline = () => setState((s) => ({ ...s, status: s.status === "live" ? "live" : "reconnecting" }));
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    client.activate();
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      void client.deactivate();
    };
  }, [qc]);

  return <RealtimeContext.Provider value={state}>{children}</RealtimeContext.Provider>;
}
