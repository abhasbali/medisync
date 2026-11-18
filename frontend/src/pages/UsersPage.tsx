import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import { Badge, Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { ErrorState, PageHeader } from "@/components/common";
import { KpiRow } from "@/components/ChartCard";
import { useHospitals } from "@/hooks/queries";
import { ROLE_LABEL, useAuth } from "@/contexts/AuthContext";
import { api, type ApiError } from "@/services/api";
import { formatDateTime } from "@/lib/format";
import { ROLES, type Role, type User } from "@/types/api";

const usersKey = ["users"] as const;

function CreateUserForm() {
  const qc = useQueryClient();
  const hospitals = useHospitals();
  const [form, setForm] = useState({ username: "", fullName: "", password: "", role: "DISPATCHER" as Role, hospitalId: "" });
  const create = useMutation({
    mutationFn: () =>
      api.createUser({
        ...form,
        hospitalId: form.role === "HOSPITAL_STAFF" && form.hospitalId ? Number(form.hospitalId) : null,
      }),
    onSuccess: (u) => {
      toast.success(`User ${u.username} created`);
      setForm({ username: "", fullName: "", password: "", role: "DISPATCHER", hospitalId: "" });
      qc.invalidateQueries({ queryKey: usersKey });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          New user
        </CardTitle>
        <CardDescription>Hospital staff can only manage the hospital they are assigned to.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-username">Username</Label>
            <Input id="nu-username" value={form.username} onChange={set("username")} autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-name">Full name</Label>
            <Input id="nu-name" value={form.fullName} onChange={set("fullName")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-password">Password (min 8)</Label>
            <Input id="nu-password" type="password" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-role">Role</Label>
            <NativeSelect id="nu-role" value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nu-hospital">Hospital</Label>
            <NativeSelect
              id="nu-hospital"
              value={form.hospitalId}
              onChange={set("hospitalId")}
              disabled={form.role !== "HOSPITAL_STAFF"}
            >
              <option value="">{form.role === "HOSPITAL_STAFF" ? "Select…" : "Not applicable"}</option>
              {hospitals.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={create.isPending || !form.username || !form.fullName || form.password.length < 8}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Create
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ u }: { u: User }) {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const self = me?.id === u.id;
  const update = useMutation({
    mutationFn: (enabled: boolean) =>
      api.updateUser(u.id, { fullName: u.fullName, role: u.role, hospitalId: u.hospitalId, enabled }),
    onSuccess: (r) => {
      toast.success(`${r.username} ${r.enabled ? "enabled" : "disabled"}`);
      qc.invalidateQueries({ queryKey: usersKey });
    },
    onError: (e) => toast.error((e as ApiError).message),
  });
  const reset = useMutation({
    mutationFn: (pw: string) => api.resetPassword(u.id, pw),
    onSuccess: () => toast.success(`Password reset for ${u.username}; they have been signed out`),
    onError: (e) => toast.error((e as ApiError).message),
  });

  const doReset = () => {
    const pw = window.prompt(`New password for ${u.username} (min 8 characters)`);
    if (pw) reset.mutate(pw);
  };

  return (
    <TR>
      <TD>
        <p className="font-medium text-foreground">{u.username}</p>
        <p className="text-xs text-muted-foreground">{u.fullName}</p>
      </TD>
      <TD>
        <span className="text-[13px]">{ROLE_LABEL[u.role]}</span>
      </TD>
      <TD>{u.hospitalName ?? <span className="text-muted-foreground">-</span>}</TD>
      <TD className="num text-xs text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</TD>
      <TD>
        {u.enabled ? (
          <Badge variant="stable">Active</Badge>
        ) : (
          <Badge variant="muted">Disabled</Badge>
        )}
      </TD>
      <TD className="space-x-1.5 whitespace-nowrap text-right">
        <Button size="sm" variant="outline" onClick={doReset} disabled={reset.isPending}>
          <KeyRound /> Reset password
        </Button>
        <Button
          size="sm"
          variant={u.enabled ? "outline" : "default"}
          disabled={self || update.isPending}
          title={self ? "You cannot disable your own account" : undefined}
          onClick={() => update.mutate(!u.enabled)}
        >
          {u.enabled ? "Disable" : "Enable"}
        </Button>
      </TD>
    </TR>
  );
}

export function UsersPage() {
  const users = useQuery({ queryKey: usersKey, queryFn: api.users });
  return (
    <div className="space-y-5">
      <PageHeader title="Users" description="Create accounts, assign roles, reset passwords and disable access." />
      {users.data && (
        <KpiRow
          items={[
            { label: "Accounts", value: String(users.data.length), sub: `${users.data.filter((u) => u.enabled).length} active` },
            { label: "Administrators", value: String(users.data.filter((u) => u.role === "ADMIN").length) },
            { label: "Dispatchers", value: String(users.data.filter((u) => u.role === "DISPATCHER").length) },
            {
              label: "Never signed in",
              value: String(users.data.filter((u) => !u.lastLoginAt).length),
              sub: "Consider disabling unused accounts",
              alert: users.data.some((u) => !u.lastLoginAt && u.role === "ADMIN"),
            },
          ]}
        />
      )}
      <CreateUserForm />
      <Card>
        <CardContent className="p-0">
          {users.isError ? (
            <ErrorState message={(users.error as Error).message} onRetry={() => users.refetch()} />
          ) : users.isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>User</TH>
                    <TH>Role</TH>
                    <TH>Hospital</TH>
                    <TH>Last login</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {users.data?.map((u) => <UserRow key={u.id} u={u} />)}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
