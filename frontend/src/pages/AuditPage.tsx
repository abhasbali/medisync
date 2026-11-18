import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { EmptyState, ErrorState, PageHeader } from "@/components/common";
import { ChartCard } from "@/components/ChartCard";
import { useActivity } from "@/hooks/queries";
import { formatDateTime } from "@/lib/format";
import { downloadCsv, stamp } from "@/lib/csv";
import { C, axisProps, numAxisProps, tooltipProps } from "@/lib/chart";
import type { ActivityType } from "@/types/api";

const label = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");

/** Admin: searchable audit trail (last 200 entries) with per-user activity and CSV export. */
export function AuditPage() {
  const { data, isLoading, isError, error, refetch } = useActivity(200);
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [type, setType] = useState<ActivityType | "">("");

  const rows = data ?? [];
  const actors = useMemo(() => [...new Set(rows.map((r) => r.actor ?? "system"))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.actionType))].sort(), [rows]);
  const filtered = rows.filter(
    (r) =>
      (!actor || (r.actor ?? "system") === actor) &&
      (!type || r.actionType === type) &&
      (!q || r.message.toLowerCase().includes(q.toLowerCase())),
  );
  const perActor = actors
    .map((a) => ({ name: a, actions: rows.filter((r) => (r.actor ?? "system") === a).length }))
    .sort((x, y) => y.actions - x.actions)
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every allocation, release, inventory edit, transfer decision and account change, with the user who made it."
        actions={
          <Button
            variant="outline"
            disabled={!filtered.length}
            onClick={() =>
              downloadCsv(
                `medisync-audit-${stamp()}.csv`,
                ["id", "time", "actor", "type", "message", "reference_id"],
                filtered.map((r) => [r.id, r.createdAt, r.actor ?? "system", r.actionType, r.message, r.referenceId]),
              )
            }
          >
            <Download /> Export CSV
          </Button>
        }
      />

      <ChartCard title="Actions by user" description="Last 200 audit entries" loading={isLoading} empty={!perActor.length} height={200}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={perActor} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="36%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis allowDecimals={false} {...numAxisProps} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="actions" name="Actions" fill={C.primary} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <Card>
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search audit log" placeholder="Search messages" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <NativeSelect aria-label="Filter by user" className="w-40" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">All users</option>
            {actors.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by action" className="w-48" value={type} onChange={(e) => setType(e.target.value as ActivityType | "")}>
            <option value="">All actions</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {label(t)}
              </option>
            ))}
          </NativeSelect>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </div>
        ) : !filtered.length ? (
          <EmptyState title="No matching entries" description="Change or clear the filters." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>User</TH>
                <TH>Action</TH>
                <TH>Details</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.id}>
                  <TD className="num whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TD>
                  <TD className="whitespace-nowrap">{r.actor ?? <span className="text-muted-foreground">system</span>}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{label(r.actionType)}</TD>
                  <TD>{r.message}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Showing {filtered.length} of the latest {rows.length} entries.
        </p>
      </Card>
    </div>
  );
}
