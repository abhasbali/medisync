import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { useAuth } from "@/contexts/AuthContext";
import type { ApiError } from "@/services/api";

const DEMO = [
  { u: "admin", p: "Admin@123", r: "Administrator" },
  { u: "dispatcher", p: "Dispatch@123", r: "Dispatcher" },
  { u: "staff1", p: "Staff@123", r: "Hospital staff" },
];

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 text-white">
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
            <rect x="7" y="1" width="6" height="18" rx="1" fill="currentColor" />
            <rect x="1" y="7" width="18" height="6" rx="1" fill="currentColor" />
          </svg>
          <span className="text-[15px] font-semibold">MediSync</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.015em] text-white">
            One live view of every bed in the network.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">
            Emergency requests are matched to the nearest hospital with a free bed of the right type. When none is free,
            patients wait in a severity-ordered queue and are placed the moment capacity opens.
          </p>
          <dl className="mt-10 grid grid-cols-3 border-t border-sidebar-border pt-5">
            {[
              ["6", "hospitals"],
              ["5", "resource types"],
              ["<1s", "update latency"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="num text-xl text-white">{v}</dt>
                <dd className="mt-0.5 text-xs text-sidebar-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-[11px] text-sidebar-muted">Academic prototype with synthetic data. Not for clinical dispatch.</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-[340px]">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Sign in</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Use your MediSync account.</p>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-username">Username</Label>
              <Input
                id="login-username"
                autoComplete="username"
                autoFocus
                className="h-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className="h-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="rounded-sm border border-crit/30 bg-crit/5 px-3 py-2 text-[13px] text-foreground">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !username || !password}>
              {busy && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-10 border-t pt-5">
            <p className="eyebrow">Demo accounts</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {DEMO.map((d) => (
                  <tr
                    key={d.u}
                    className="cursor-pointer border-b last:border-0 hover:bg-background"
                    onClick={() => {
                      setUsername(d.u);
                      setPassword(d.p);
                    }}
                    title="Click to fill"
                  >
                    <td className="num py-1.5 pr-3 text-foreground">{d.u}</td>
                    <td className="num py-1.5 pr-3 text-muted-foreground">{d.p}</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground">{d.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
