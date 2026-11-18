import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeftRight, BarChart3, Building2, Hospital, LayoutGrid, LogOut, Menu, ScrollText, Siren, Users, X } from "lucide-react";
import { useRealtime, type ConnectionStatus } from "@/contexts/RealtimeContext";
import { ROLE_LABEL, useAuth } from "@/contexts/AuthContext";
import type { Role } from "@/types/api";
import { cn } from "@/lib/utils";
import { AlertsBell } from "@/components/AlertsBell";

const NAV: { to: string; label: string; icon: typeof Siren; end?: boolean; roles?: Role[] }[] = [
  { to: "/", label: "Bed board", icon: LayoutGrid, end: true },
  { to: "/my-hospital", label: "My hospital", icon: Hospital, roles: ["HOSPITAL_STAFF"] },
  { to: "/emergency", label: "Emergency", icon: Siren },
  { to: "/sharing", label: "Transfers", icon: ArrowLeftRight },
  { to: "/admin", label: "Inventory", icon: Building2, roles: ["ADMIN", "HOSPITAL_STAFF"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/users", label: "Users", icon: Users, roles: ["ADMIN"] },
  { to: "/audit", label: "Audit log", icon: ScrollText, roles: ["ADMIN"] },
];

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  live: { label: "Live", dot: "bg-ok animate-pulse-dot" },
  reconnecting: { label: "Reconnecting", dot: "bg-low animate-pulse-dot" },
  offline: { label: "Offline", dot: "bg-crit" },
};

export function ConnectionBadge({ className }: { className?: string }) {
  const { status } = useRealtime();
  const s = STATUS[status];
  return (
    <span
      role="status"
      aria-live="polite"
      title="Real-time WebSocket connection"
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", className)}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

/** Wordmark: a plain cross glyph and the product name. */
function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-white">
      <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
        <rect x="7" y="1" width="6" height="18" rx="1" fill="currentColor" />
        <rect x="1" y="7" width="18" height="6" rx="1" fill="currentColor" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">MediSync</span>
    </Link>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, hasRole } = useAuth();
  const nav = NAV.filter((n) => !n.roles || hasRole(...n.roles));
  const initials = user?.fullName
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center justify-between px-4">
        <Wordmark />
        <AlertsBell />
      </div>
      <div className="px-4 pb-1">
        <ConnectionBadge className="text-sidebar-muted" />
      </div>

      <nav className="flex-1 px-2 py-3" aria-label="Main">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">Operations</p>
        <ul className="space-y-px">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-sidebar-active font-medium text-white before:absolute before:inset-y-1.5 before:-left-2 before:w-0.5 before:bg-white"
                      : "hover:bg-sidebar-active/60 hover:text-white",
                  )
                }
              >
                <Icon className="size-4 opacity-80" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {user && (
        <div className="border-t border-sidebar-border p-2">
          <Link
            to="/account"
            onClick={onNavigate}
            className="flex items-center gap-2.5 rounded-sm px-2 py-2 hover:bg-sidebar-active"
            title="My account"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-sidebar-active text-[11px] font-semibold text-white">
              {initials || "?"}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-white">{user.fullName}</span>
              <span className="block truncate text-[11px] text-sidebar-muted">
                {user.hospitalName ?? ROLE_LABEL[user.role]}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="mt-px flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] hover:bg-sidebar-active hover:text-white"
          >
            <LogOut className="size-4 opacity-80" aria-hidden /> Sign out
          </button>
        </div>
      )}
      <p className="px-4 pb-3 text-[10px] leading-relaxed text-sidebar-muted">
        Academic prototype · synthetic data. Not for clinical dispatch.
      </p>
    </div>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-sidebar px-4 lg:hidden">
        <Wordmark />
        <div className="flex items-center gap-3">
          <ConnectionBadge className="text-sidebar-muted" />
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="text-white">
            <Menu className="size-5" />
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 text-sidebar-muted hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <main className="lg:pl-56">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
