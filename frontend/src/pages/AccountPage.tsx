import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/common";
import { ROLE_LABEL, useAuth } from "@/contexts/AuthContext";
import { api, type ApiError } from "@/services/api";

export function AccountPage() {
  const { user, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.changePassword(current, next);
      toast.success("Password changed. Please sign in again.");
      logout();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="My account" description="Your profile and password." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{user.fullName}</CardTitle>
            <CardDescription>@{user.username}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <p>
              <span className="text-muted-foreground">Role:</span> {ROLE_LABEL[user.role]}
            </p>
            {user.hospitalName && (
              <p>
                <span className="text-muted-foreground">Hospital:</span> {user.hospitalName}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Change password
            </CardTitle>
            <CardDescription>Changing your password signs you out on every device.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pw-current">Current password</Label>
                <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pw-new">New password (min 8)</Label>
                <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pw-confirm">Confirm new password</Label>
                <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              {(mismatch || error) && (
                <p role="alert" className="text-[13px] font-medium text-destructive">
                  {mismatch ? "Passwords do not match" : error}
                </p>
              )}
              <Button type="submit" disabled={busy || !current || next.length < 8 || next !== confirm}>
                {busy && <Loader2 className="animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
