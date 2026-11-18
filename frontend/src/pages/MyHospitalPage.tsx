import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { EmptyState, PageHeader, SeverityBadge, TransferStatusBadge } from "@/components/common";
import { ChartCard, KpiRow } from "@/components/ChartCard";
import { useAuth } from "@/contexts/AuthContext";
import { useHospitals, useRequests, useTransfers } from "@/hooks/queries";
import { RESOURCE_LABELS, formatKm, timeAgo } from "@/lib/format";
import { C, axisProps, numAxisProps, tooltipProps } from "@/lib/chart";

/** Hospital staff home: their own capacity, admitted patients and transfers needing action. */
export function MyHospitalPage() {
  const { user } = useAuth();
  const hospitals = useHospitals();
  const requests = useRequests({ status: "ALLOCATED" });
  const transfers = useTransfers();

  const h = hospitals.data?.find((x) => x.id === user?.hospitalId);
  const patients = (requests.data ?? []).filter((r) => r.hospitalId === user?.hospitalId);
  const all = (transfers.data ?? []).filter((t) => t.donorHospitalId === user?.hospitalId || t.requesterHospitalId === user?.hospitalId);
  const incoming = all.filter((t) => t.donorHospitalId === user?.hospitalId && t.status === "PENDING");

  if (!user?.hospitalId) {
    return <EmptyState title="No hospital assigned" description="Ask an administrator to assign your account to a hospital." className="py-24" />;
  }

  const chart = (h?.inventory ?? []).map((i) => ({ name: RESOURCE_LABELS[i.resourceType], Free: i.available, Occupied: i.total - i.available }));
  const pct = h && h.totalCapacity ? Math.round(((h.totalCapacity - h.totalAvailable) / h.totalCapacity) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={h?.name ?? "My hospital"}
        description={h ? `${h.area} · ${h.phone}` : "Loading…"}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin">Edit inventory</Link>
          </Button>
        }
      />

      <KpiRow
        items={[
          { label: "Free units", value: h ? `${h.totalAvailable}/${h.totalCapacity}` : "-", sub: `${pct}% occupied`, alert: pct >= 85 },
          { label: "Admitted patients", value: String(patients.length), sub: "Allocated by the system" },
          { label: "Transfer requests", value: String(incoming.length), sub: "Awaiting your decision", alert: incoming.length > 0 },
          {
            label: "Critical admitted",
            value: String(patients.filter((p) => p.severity === "CRITICAL").length),
            sub: "Patients in critical condition",
          },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ChartCard
          title="Capacity by resource"
          loading={hospitals.isLoading}
          legend={[
            { label: "Free", color: C.primary },
            { label: "Occupied", color: C.gray },
          ]}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="34%">
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...numAxisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="Free" stackId="a" fill={C.primary} />
              <Bar dataKey="Occupied" stackId="a" fill={C.gray} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Transfers involving us</CardTitle>
              <CardDescription>Requests we sent and requests sent to us</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/sharing">Open transfers</Link>
            </Button>
          </CardHeader>
          {!all.length ? (
            <EmptyState title="No transfers yet" />
          ) : (
            <ol className="max-h-[248px] divide-y overflow-y-auto">
              {all.slice(0, 12).map((t) => {
                const outgoing = t.requesterHospitalId === user.hospitalId;
                return (
                  <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px]">
                        {outgoing ? <>We requested from {t.donorHospitalName}</> : <>{t.requesterHospitalName} requests from us</>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="num">{t.quantity}</span> × {RESOURCE_LABELS[t.resourceType]} · {timeAgo(t.createdAt)}
                      </p>
                    </div>
                    <TransferStatusBadge status={t.status} />
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admitted patients</CardTitle>
          <CardDescription>Patients the system has placed in this hospital</CardDescription>
        </CardHeader>
        {!patients.length ? (
          <EmptyState title="No admitted patients" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>ID</TH>
                <TH>Patient</TH>
                <TH>Severity</TH>
                <TH>Resource</TH>
                <TH className="text-right">Distance</TH>
                <TH>Admitted</TH>
              </TR>
            </THead>
            <TBody>
              {patients.map((p) => (
                <TR key={p.id}>
                  <TD className="num text-xs text-muted-foreground">{p.id}</TD>
                  <TD>
                    <p className="font-medium">{p.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.patientAge} yrs · {p.patientCondition}
                    </p>
                  </TD>
                  <TD>
                    <SeverityBadge severity={p.severity} />
                  </TD>
                  <TD>{RESOURCE_LABELS[p.resourceType]}</TD>
                  <TD className="num text-right text-xs">{formatKm(p.distanceKm)}</TD>
                  <TD className="text-xs text-muted-foreground">{p.allocatedAt ? timeAgo(p.allocatedAt) : "-"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
