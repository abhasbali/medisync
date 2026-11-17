import { NavLink, Outlet } from "react-router-dom";
import { Activity, Building2, HeartPulse, Info, LayoutDashboard, Share2, Siren } from "lucide-react";
import { useRealtime, type ConnectionStatus } from "@/contexts/RealtimeContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/emergency", label: "Emergency", icon: Siren },
  { to: "/sharing", label: "Resource Sharing", icon: Share2 },
  { to: "/admin", label: "Hospital Admin", icon: Building2 },
];

const STATUS_STYLE: Record<ConnectionStatus, { label: string; dot: string; pill: string }> = {
  live: { label: "Live", dot: "bg-emerald-500 animate-pulse-dot", pill: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  reconnecting: { label: "Reconnecting", dot: "bg-amber-500 animate-pulse-dot", pill: "border-amber-200 bg-amber-50 text-amber-800" },
  offline: { label: "Offline", dot: "bg-red-500", pill: "border-red-200 bg-red-50 text-red-700" },
};

export function ConnectionBadge() {
  const { status } = useRealtime();
  const s = STATUS_STYLE[status];
  return (
    <span
      role="status"
      aria-live="polite"
      title="Real-time WebSocket connection"
      className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", s.pill)}
    >
      <span className={cn("size-2 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

export function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-blue-600 text-white shadow-sm">
              <HeartPulse className="size-5" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tracking-tight text-slate-900">
                Medi<span className="text-teal-600">Sync</span> Live
              </p>
              <p className="text-xs text-muted-foreground">Real-Time Hospital Resource Management</p>
            </div>
          </div>
          <ConnectionBadge />
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6" aria-label="Main">
          <ul className="flex gap-1 pb-2">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 text-xs text-amber-900 sm:px-6">
          <Info className="size-3.5 shrink-0" aria-hidden />
          Academic demonstration prototype with synthetic data. Not a clinically validated or authorised emergency
          dispatch system. No login or role enforcement.
        </p>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto flex max-w-7xl items-center gap-2 px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        <Activity className="size-3.5" aria-hidden /> MediSync Live - Spring Boot, MySQL, STOMP WebSocket and React
      </footer>
    </div>
  );
}
