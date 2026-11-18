import { useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { useAlerts } from "@/contexts/AlertsContext";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const RULE = { critical: "bg-crit", warning: "bg-low", info: "bg-primary" } as const;

/** Bell with unread count and a dropdown of recent alerts. */
export function AlertsBell() {
  const { alerts, unread, markAllRead, clear, sound, setSound } = useAlerts();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Alerts${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        className="relative flex size-7 items-center justify-center rounded-sm text-sidebar-muted hover:bg-sidebar-active hover:text-white"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-sm bg-crit px-0.5 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 w-80 overflow-hidden rounded-md border bg-card text-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-[13px] font-semibold">Alerts</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSound(!sound)}
                className="flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                title={sound ? "Sound on" : "Sound off"}
              >
                {sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                Sound
              </button>
              {alerts.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-sm px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {alerts.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No alerts. You'll be notified of critical patients, capacity drops and transfer requests.
            </p>
          ) : (
            <ol className="max-h-96 divide-y overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className="grid grid-cols-[3px_1fr] gap-x-2.5 px-3 py-2.5">
                  <span className={cn("rounded-full", RULE[a.level])} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-snug">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                    <p className="num mt-1 text-[10px] text-muted-foreground">{timeAgo(new Date(a.at).toISOString())}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
