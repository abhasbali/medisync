import { useMemo, useState } from "react";
import { BedDouble, Building2, Clock, LayoutDashboard, MapPin, Phone, Route, Users, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHospitals, useStats } from "@/hooks/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, Label } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { AvailabilityBar } from "@/components/AvailabilityBar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { EmptyState, ErrorState, PageHeader } from "@/components/common";
import { LEVEL_LABEL, RESOURCE_LABELS, availabilityLevel, type AvailabilityLevel } from "@/lib/format";
import { RESOURCE_TYPES, type Hospital, type ResourceType, type Stats } from "@/types/api";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
          )}
          {sub && !loading && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", tone)}>
          <Icon className="size-5" aria-hidden />
        </div>
      </div>
    </Card>
  );
}

function SummaryCards({ stats, loading }: { stats?: Stats; loading: boolean }) {
  const pct = stats && stats.totalCapacity > 0 ? Math.round((stats.totalAvailable / stats.totalCapacity) * 100) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={BedDouble}
        label="Available resources"
        value={stats ? `${stats.totalAvailable} / ${stats.totalCapacity}` : "-"}
        sub={stats ? `${pct}% of all beds and equipment free` : undefined}
        tone="bg-teal-50 text-teal-700"
        loading={loading}
      />
      <StatCard
        icon={Users}
        label="Active admissions"
        value={String(stats?.activeAdmissions ?? "-")}
        sub="Requests with a reserved bed"
        tone="bg-blue-50 text-blue-700"
        loading={loading}
      />
      <StatCard
        icon={Clock}
        label="Waiting patients"
        value={String(stats?.waitingPatients ?? "-")}
        sub="Pending in the priority queue"
        tone={stats && stats.waitingPatients > 0 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}
        loading={loading}
      />
      <StatCard
        icon={Route}
        label="Avg. allocation distance"
        value={stats?.averageDistanceKm != null ? `${stats.averageDistanceKm.toFixed(1)} km` : "-"}
        sub="Straight-line, all allocations"
        tone="bg-indigo-50 text-indigo-600"
        loading={loading}
      />
    </div>
  );
}

function CapacityChart({ stats }: { stats?: Stats }) {
  const data = (stats?.byResource ?? []).map((r) => ({
    name: RESOURCE_LABELS[r.resourceType],
    Available: r.available,
    Occupied: r.total - r.available,
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity by resource type</CardTitle>
        <CardDescription>Available and occupied units across all hospitals</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {!stats ? (
          <Skeleton className="h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "rgba(148,163,184,0.12)" }}
                contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#475569" }} />
              <Bar dataKey="Available" stackId="a" fill="#0d9488" stroke="#fff" strokeWidth={2} />
              <Bar dataKey="Occupied" stackId="a" fill="#cbd5e1" stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function HospitalCard({ hospital, types }: { hospital: Hospital; types: ResourceType[] }) {
  const rows = hospital.inventory.filter((i) => types.includes(i.resourceType));
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[15px]">{hospital.name}</CardTitle>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600">
            {hospital.totalAvailable}/{hospital.totalCapacity}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden /> {hospital.area}
          </span>
          <a className="inline-flex items-center gap-1 hover:text-teal-700" href={`tel:${hospital.phone}`}>
            <Phone className="size-3" aria-hidden /> {hospital.phone}
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((i) => (
          <AvailabilityBar key={i.id} type={i.resourceType} available={i.available} total={i.total} />
        ))}
      </CardContent>
    </Card>
  );
}

const LEVEL_FILTERS: AvailabilityLevel[] = ["good", "low", "critical"];

export function DashboardPage() {
  const hospitals = useHospitals();
  const stats = useStats();
  const [hospitalFilter, setHospitalFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ResourceType | "">("");
  const [levelFilter, setLevelFilter] = useState<AvailabilityLevel | "">("");

  const visible = useMemo(() => {
    const list = hospitals.data ?? [];
    return list
      .filter((h) => !hospitalFilter || String(h.id) === hospitalFilter)
      .map((h) => {
        const types = RESOURCE_TYPES.filter((t) => {
          if (typeFilter && t !== typeFilter) return false;
          if (!levelFilter) return true;
          const row = h.inventory.find((i) => i.resourceType === t);
          return row ? availabilityLevel(row.available, row.total) === levelFilter : false;
        });
        return { hospital: h, types };
      })
      .filter((x) => x.types.length > 0);
  }, [hospitals.data, hospitalFilter, typeFilter, levelFilter]);

  const filtered = hospitalFilter || typeFilter || levelFilter;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Live dashboard"
        description="Real-time availability of emergency, ICU, ventilator, general and oxygen-supported beds."
      />
      <SummaryCards stats={stats.data} loading={stats.isLoading} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6 min-w-0">
          <Card className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
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
              <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
                <Label htmlFor="f-type">Resource type</Label>
                <NativeSelect id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ResourceType | "")}>
                  <option value="">All resources</option>
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {RESOURCE_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
                <Label htmlFor="f-level">Availability</Label>
                <NativeSelect id="f-level" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as AvailabilityLevel | "")}>
                  <option value="">Any level</option>
                  {LEVEL_FILTERS.map((l) => (
                    <option key={l} value={l}>
                      {l === "good" ? "Adequate (40% or more free)" : l === "low" ? "Low (15% to 40%)" : "Critical (below 15%)"}
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
                  Clear
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {(["good", "low", "critical"] as const).map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      l === "good" ? "bg-emerald-500" : l === "low" ? "bg-amber-500" : "bg-red-500",
                    )}
                  />
                  {LEVEL_LABEL[l]} {l === "good" ? "≥ 40%" : l === "low" ? "15-40%" : "< 15%"}
                </span>
              ))}
            </div>
          </Card>

          {hospitals.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-xl" />
              ))}
            </div>
          ) : hospitals.isError ? (
            <ErrorState message={(hospitals.error as Error).message} onRetry={() => hospitals.refetch()} />
          ) : visible.length === 0 ? (
            <Card>
              <EmptyState icon={Building2} title="No matching resources" description="Change or clear the filters." />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map(({ hospital, types }) => (
                <HospitalCard key={hospital.id} hospital={hospital} types={types} />
              ))}
            </div>
          )}

          <CapacityChart stats={stats.data} />
        </div>

        <ActivityFeed className="lg:sticky lg:top-36 lg:self-start" />
      </div>
    </div>
  );
}
