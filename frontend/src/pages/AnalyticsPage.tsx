import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/common";
import { ChartCard, KpiRow } from "@/components/ChartCard";
import { useHospitals, useRequests, useTransfers } from "@/hooks/queries";
import { availabilityLevel, RESOURCE_LABELS, SEVERITY_LABELS } from "@/lib/format";
import { C, SEVERITY_COLOR, axisProps, fmtMinutes, median, minutesBetween, numAxisProps, tooltipProps } from "@/lib/chart";
import { SEVERITIES, REQUEST_STATUSES, RESOURCE_TYPES } from "@/types/api";

const LEVEL_COLOR = { good: C.ok, low: C.low, critical: C.crit, none: C.gray } as const;

export function AnalyticsPage() {
  const requests = useRequests({});
  const hospitals = useHospitals();
  const transfers = useTransfers();
  const reqs = requests.data ?? [];
  const hs = hospitals.data ?? [];
  const ts = transfers.data ?? [];

  const a = useMemo(() => {
    // Hourly volume, last 24h, stacked by severity.
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const hours = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now.getTime() - (23 - i) * 3600_000);
      return { t: d.getTime(), label: `${String(d.getHours()).padStart(2, "0")}:00`, CRITICAL: 0, SERIOUS: 0, STABLE: 0 };
    });
    for (const r of reqs) {
      const t = new Date(r.createdAt);
      t.setMinutes(0, 0, 0);
      const slot = hours.find((h) => h.t === t.getTime());
      if (slot) slot[r.severity]++;
    }

    const byStatus = REQUEST_STATUSES.map((s) => ({ name: s.charAt(0) + s.slice(1).toLowerCase(), value: reqs.filter((r) => r.status === s).length }));

    const occupancy = hs
      .map((h) => ({
        name: h.name.replace(/ (Hospitals?|Medical Centre|Healthcare)$/i, ""),
        occupied: h.totalCapacity ? Math.round(((h.totalCapacity - h.totalAvailable) / h.totalCapacity) * 100) : 0,
        level: availabilityLevel(h.totalAvailable, h.totalCapacity),
      }))
      .sort((x, y) => y.occupied - x.occupied);

    const allocated = reqs.filter((r) => r.allocatedAt && r.hospitalName);
    const perHospital = hs.map((h) => {
      const mine = allocated.filter((r) => r.hospitalId === h.id);
      const d = mine.map((r) => r.distanceKm ?? 0);
      return {
        name: h.name.replace(/ (Hospitals?|Medical Centre|Healthcare)$/i, ""),
        allocations: mine.length,
        avgKm: d.length ? +(d.reduce((s, x) => s + x, 0) / d.length).toFixed(1) : 0,
      };
    });

    const waitBySeverity = SEVERITIES.map((s) => {
      const w = allocated.filter((r) => r.severity === s).map((r) => minutesBetween(r.createdAt, r.allocatedAt!));
      return { name: SEVERITY_LABELS[s], severity: s, median: +(median(w) ?? 0).toFixed(1), n: w.length };
    });

    const approved = ts.filter((t) => t.status === "APPROVED");
    const flow = hs.map((h) => ({
      name: h.name.replace(/ (Hospitals?|Medical Centre|Healthcare)$/i, ""),
      received: approved.filter((t) => t.requesterHospitalId === h.id).reduce((s, t) => s + t.quantity, 0),
      lent: -approved.filter((t) => t.donorHospitalId === h.id).reduce((s, t) => s + t.quantity, 0),
    }));

    const byResource = RESOURCE_TYPES.map((t) => ({
      name: RESOURCE_LABELS[t],
      requests: reqs.filter((r) => r.resourceType === t).length,
      waiting: reqs.filter((r) => r.resourceType === t && r.status === "PENDING").length,
    }));

    const allWaits = allocated.map((r) => minutesBetween(r.createdAt, r.allocatedAt!));
    const decided = ts.filter((t) => t.status !== "PENDING");
    return {
      hours,
      byStatus,
      occupancy,
      perHospital,
      waitBySeverity,
      flow,
      byResource,
      kpis: [
        { label: "Requests", value: String(reqs.length), sub: `${reqs.filter((r) => r.status === "PENDING").length} waiting now` },
        {
          label: "Allocation rate",
          value: reqs.length ? `${Math.round((allocated.length / reqs.length) * 100)}%` : "-",
          sub: "Requests that received a bed",
        },
        { label: "Median wait", value: fmtMinutes(median(allWaits)), sub: "Request to allocation" },
        {
          label: "Transfer approval",
          value: decided.length ? `${Math.round((approved.length / decided.length) * 100)}%` : "-",
          sub: `${ts.filter((t) => t.status === "PENDING").length} pending decision`,
        },
      ],
    };
  }, [reqs, hs, ts]);

  const loading = requests.isLoading || hospitals.isLoading || transfers.isLoading;

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" description="Demand, occupancy, waiting times and inter-hospital sharing across the network." />
      <KpiRow items={a.kpis} />

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard
          title="Request volume, last 24 hours"
          description="New requests per hour by severity"
          loading={loading}
          legend={SEVERITIES.map((s) => ({ label: SEVERITY_LABELS[s], color: SEVERITY_COLOR[s] }))}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.hours} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" {...axisProps} interval={3} />
              <YAxis allowDecimals={false} {...numAxisProps} />
              <Tooltip {...tooltipProps} />
              {SEVERITIES.map((s) => (
                <Bar key={s} dataKey={s} name={SEVERITY_LABELS[s]} stackId="a" fill={SEVERITY_COLOR[s]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Occupancy by hospital" description="Share of all units in use" loading={loading} empty={!a.occupancy.length}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.occupancy} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" domain={[0, 100]} unit="%" {...numAxisProps} />
              <YAxis type="category" dataKey="name" width={110} {...axisProps} />
              <Tooltip {...tooltipProps} formatter={(v) => [`${v}%`, "Occupied"]} />
              <Bar dataKey="occupied">
                {a.occupancy.map((o) => (
                  <Cell key={o.name} fill={LEVEL_COLOR[o.level]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Median wait to allocation"
          description="Minutes from request to bed, by severity"
          loading={loading}
          empty={!a.waitBySeverity.some((w) => w.n)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.waitBySeverity} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="40%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...numAxisProps} unit="m" />
              <Tooltip {...tooltipProps} formatter={(v, _n, p) => [`${v} min (n=${p.payload.n})`, "Median wait"]} />
              <Bar dataKey="median">
                {a.waitBySeverity.map((w) => (
                  <Cell key={w.severity} fill={SEVERITY_COLOR[w.severity]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Allocations and distance by hospital"
          description="Patients placed (bars) and average distance travelled (line)"
          loading={loading}
          legend={[
            { label: "Allocations", color: C.primary },
            { label: "Avg km", color: C.low },
          ]}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={a.perHospital} margin={{ top: 4, right: 0, left: -24, bottom: 0 }} barCategoryGap="34%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis yAxisId="l" allowDecimals={false} {...numAxisProps} />
              <YAxis yAxisId="r" orientation="right" {...numAxisProps} unit="km" />
              <Tooltip {...tooltipProps} />
              <Bar yAxisId="l" dataKey="allocations" name="Allocations" fill={C.primary} />
              <Line yAxisId="r" dataKey="avgKm" name="Avg km" stroke={C.low} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Demand by resource"
          description="All requests and those still waiting"
          loading={loading}
          legend={[
            { label: "Requests", color: C.primarySoft },
            { label: "Waiting", color: C.crit },
          ]}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.byResource} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis allowDecimals={false} {...numAxisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="requests" name="Requests" fill={C.primarySoft} />
              <Bar dataKey="waiting" name="Waiting" fill={C.crit} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Capacity sharing"
          description="Units received vs lent through approved transfers"
          loading={loading}
          legend={[
            { label: "Received", color: C.ok },
            { label: "Lent", color: C.primary },
          ]}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.flow} stackOffset="sign" margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="34%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis allowDecimals={false} {...numAxisProps} />
              <Tooltip {...tooltipProps} formatter={(v, n) => [Math.abs(Number(v)), n]} />
              <Bar dataKey="received" name="Received" stackId="f" fill={C.ok} />
              <Bar dataKey="lent" name="Lent" stackId="f" fill={C.primary} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Requests by status" description="Current lifecycle of all requests" loading={loading} className="lg:col-span-2" height={180}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={a.byStatus} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" allowDecimals={false} {...numAxisProps} />
              <YAxis type="category" dataKey="name" width={80} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="value" name="Requests">
                {a.byStatus.map((b) => (
                  <Cell key={b.name} fill={b.name === "Pending" ? C.crit : b.name === "Allocated" ? C.primary : b.name === "Discharged" ? C.ok : C.gray} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
