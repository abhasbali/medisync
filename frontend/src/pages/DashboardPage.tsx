import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHospitals, useStats } from "@/hooks/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, Label } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/ActivityFeed";
import { NetworkMap } from "@/components/NetworkMap";
import { EmptyState, ErrorState, PageHeader } from "@/components/common";
import {
  LEVEL_BAR_CLASS,
  LEVEL_LABEL,
  LEVEL_TEXT_CLASS,
  RESOURCE_LABELS,
  availabilityLevel,
  availabilityPercent,
  type AvailabilityLevel,
} from "@/lib/format";
import { RESOURCE_TYPES, type Hospital, type Inventory, type ResourceType, type Stats } from "@/types/api";
import { cn } from "@/lib/utils";

/* ---------- KPI strip ---------- */

function Kpi({ label, value, unit, sub, alert, loading }: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  alert?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <p className={cn("num mt-1 text-[26px] font-medium leading-8", alert ? "text-crit" : "text-foreground")}>
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
        </p>
      )}
      {sub && !loading && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function KpiStrip({ stats, loading }: { stats?: Stats; loading: boolean }) {
  const pct = stats && stats.totalCapacity > 0 ? Math.round((stats.totalAvailable / stats.totalCapacity) * 100) : 0;
  return (
    <Card className="grid grid-cols-2 divide-x divide-y sm:divide-y-0 lg:grid-cols-4 [&>*:nth-child(3)]:border-l-0 sm:[&>*:nth-child(3)]:border-l">
      <Kpi
        label="Free capacity"
        value={stats ? String(stats.totalAvailable) : "-"}
        unit={stats ? `/ ${stats.totalCapacity}` : undefined}
        sub={stats ? `${pct}% of beds and equipment` : undefined}
        loading={loading}
      />
      <Kpi label="Active admissions" value={String(stats?.activeAdmissions ?? "-")} sub="Patients holding a bed" loading={loading} />
      <Kpi
        label="Waiting"
        value={String(stats?.waitingPatients ?? "-")}
        sub="In the priority queue"
        alert={!!stats && stats.waitingPatients > 0}
        loading={loading}
      />
      <Kpi
        label="Avg. distance"
        value={stats?.averageDistanceKm != null ? stats.averageDistanceKm.toFixed(1) : "-"}
        unit={stats?.averageDistanceKm != null ? "km" : undefined}
        sub="Straight line, all allocations"
        loading={loading}
      />
    </Card>
  );
}

/* ---------- Bed board ---------- */

function BoardCell({ row, dim }: { row?: Inventory; dim: boolean }) {
  if (!row) return <td className="px-3 py-2.5 text-muted-foreground">-</td>;
  const level = availabilityLevel(row.available, row.total);
  const pct = availabilityPercent(row.available, row.total);
  return (
    <td
      className={cn("px-3 py-2.5 align-middle transition-opacity", dim && "opacity-25")}
      title={`${RESOURCE_LABELS[row.resourceType]}: ${row.available} of ${row.total} free · ${LEVEL_LABEL[level]}`}
    >
      <div className="num flex items-baseline justify-end gap-0.5 text-[13px]">
        <span className={cn("font-medium", level === "critical" ? LEVEL_TEXT_CLASS.critical : "text-foreground")}>
          {row.available}
        </span>
        <span className="text-muted-foreground">/{row.total}</span>
      </div>
      <div className="mt-1.5 h-1 w-full bg-secondary" aria-hidden>
        <div className={cn("h-full", LEVEL_BAR_CLASS[level])} style={{ width: `${pct}%` }} />
      </div>
    </td>
  );
}

function BedBoard({
  rows,
  types,
  level,
}: {
  rows: Hospital[];
  types: ResourceType[];
  level: AvailabilityLevel | "";
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b">
            <th className="h-8 px-4 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Hospital
            </th>
            {types.map((t) => (
              <th key={t} className="h-8 w-[13%] px-3 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {RESOURCE_LABELS[t]}
              </th>
            ))}
            <th className="h-8 w-[11%] px-4 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id} className="border-b last:border-0 hover:bg-background/60">
              <td className="px-4 py-2.5">
                <p className="font-medium text-foreground">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {h.area} ·{" "}
                  <a className="num hover:text-foreground" href={`tel:${h.phone}`}>
                    {h.phone}
                  </a>
                </p>
              </td>
              {types.map((t) => {
                const row = h.inventory.find((i) => i.resourceType === t);
                const dim = !!level && (!row || availabilityLevel(row.available, row.total) !== level);
                return <BoardCell key={t} row={row} dim={dim} />;
              })}
              <td className="num px-4 py-2.5 text-right">
                <span className="font-medium">{h.totalAvailable}</span>
                <span className="text-muted-foreground">/{h.totalCapacity}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Capacity chart ---------- */

function CapacityChart({ stats }: { stats?: Stats }) {
  const data = (stats?.byResource ?? []).map((r) => ({
    name: RESOURCE_LABELS[r.resourceType],
    Free: r.available,
    Occupied: r.total - r.available,
  }));
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Network capacity by resource</CardTitle>
          <CardDescription>Free and occupied units across all hospitals</CardDescription>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 bg-primary" /> Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 bg-[#d4d6dc]" /> Occupied
          </span>
        </div>
      </CardHeader>
      <CardContent className="h-60">
        {!stats ? (
          <Skeleton className="h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="34%">
              <CartesianGrid vertical={false} stroke="#ececef" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#6b6f7b", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9a9ea8", fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.03)" }}
                contentStyle={{ borderRadius: 4, border: "1px solid #e4e5e9", fontSize: 12, boxShadow: "none" }}
              />
              <Bar dataKey="Free" stackId="a" fill="#2b4a8c" />
              <Bar dataKey="Occupied" stackId="a" fill="#d4d6dc" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Page ---------- */

const LEVELS: { value: AvailabilityLevel; label: string }[] = [
  { value: "good", label: "Adequate (≥ 40% free)" },
  { value: "low", label: "Low (15–40%)" },
  { value: "critical", label: "Critical (< 15%)" },
];

export function DashboardPage() {
  const hospitals = useHospitals();
  const stats = useStats();
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResourceType | "">("");
  const [levelFilter, setLevelFilter] = useState<AvailabilityLevel | "">("");

  const types = typeFilter ? [typeFilter] : [...RESOURCE_TYPES];
  const rows = useMemo(() => {
    return (hospitals.data ?? [])
      .filter((h) => !hospitalFilter || String(h.id) === hospitalFilter)
      .filter(
        (h) =>
          !levelFilter ||
          types.some((t) => {
            const r = h.inventory.find((i) => i.resourceType === t);
            return r && availabilityLevel(r.available, r.total) === levelFilter;
          }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitals.data, hospitalFilter, typeFilter, levelFilter]);

  const filtered = hospitalFilter || typeFilter || levelFilter;

  return (
    <div className="space-y-5">
      <PageHeader title="Bed board" description="Live availability of emergency, ICU, ventilator, general and oxygen beds across the network." />

      <KpiStrip stats={stats.data} loading={stats.isLoading} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
              <div className="flex min-w-[170px] flex-1 flex-col gap-1.5">
                <Label htmlFor="f-hospital">Hospital</Label>
                <NativeSelect id="f-hospital" value={hospitalFilter} onChange={(e) => setHospitalFilter(e.target.value)}>
                  <option value="">All hospitals</option>
                  {hospitals.data?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                <Label htmlFor="f-type">Resource</Label>
                <NativeSelect id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ResourceType | "")}>
                  <option value="">All resources</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RESOURCE_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                <Label htmlFor="f-level">Availability</Label>
                <NativeSelect id="f-level" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as AvailabilityLevel | "")}>
                  <option value="">Any level</option>
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {filtered && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setHospitalFilter("");
                    setTypeFilter("");
                    setLevelFilter("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {hospitals.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : hospitals.isError ? (
              <div className="p-4">
                <ErrorState message={(hospitals.error as Error).message} onRetry={() => hospitals.refetch()} />
              </div>
            ) : rows.length === 0 ? (
              <EmptyState title="No matching hospitals" description="Change or clear the filters." />
            ) : (
              <BedBoard rows={rows} types={types} level={levelFilter} />
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-4 py-2 text-[11px] text-muted-foreground">
              <span>Free / total units.</span>
              {(["good", "low", "critical"] as const).map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-1 w-3", LEVEL_BAR_CLASS[l])} />
                  {LEVEL_LABEL[l]} {l === "good" ? "≥ 40%" : l === "low" ? "15–40%" : "< 15%"}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid gap-5 2xl:grid-cols-2">
            <NetworkMap />
            <CapacityChart stats={stats.data} />
          </div>
        </div>

        <ActivityFeed className="xl:sticky xl:top-6 xl:self-start" />
      </div>
    </div>
  );
}
