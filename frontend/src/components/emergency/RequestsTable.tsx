import { useEffect, useState } from "react";
import { ClipboardList, LogOut, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { ConfirmAction, EmptyState, ErrorState, RequestStatusBadge, ResourceIcon, SeverityBadge } from "@/components/common";
import { useCancelRequest, useDischarge, useRequests } from "@/hooks/queries";
import { RESOURCE_LABELS, formatDateTime, formatKm, SEVERITY_LABELS } from "@/lib/format";
import { REQUEST_STATUSES, SEVERITIES, type EmergencyRequest, type RequestStatus, type Severity } from "@/types/api";
import type { ApiError } from "@/services/api";

function useDebounced(value: string, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function RowActions({ r }: { r: EmergencyRequest }) {
  const discharge = useDischarge();
  const cancel = useCancelRequest();
  const busy = discharge.isPending || cancel.isPending;

  const run = (fn: typeof discharge, verb: string) =>
    fn.mutate(r.id, {
      onSuccess: () => toast.success(`Request #${r.id} ${verb}`),
      onError: (e) => toast.error((e as ApiError).message),
    });

  if (r.status !== "ALLOCATED" && r.status !== "PENDING") {
    return <span className="text-xs text-muted-foreground">Closed</span>;
  }
  return (
    <div className="flex justify-end gap-1.5">
      {r.status === "ALLOCATED" && (
        <ConfirmAction
          trigger={
            <Button size="sm" variant="success" disabled={busy}>
              <LogOut /> Discharge
            </Button>
          }
          title={`Discharge ${r.patientName}?`}
          description={`The ${RESOURCE_LABELS[r.resourceType]} bed at ${r.hospitalName} will be released and offered to the highest-priority waiting patient.`}
          confirmLabel="Discharge"
          onConfirm={() => run(discharge, "discharged")}
        />
      )}
      <ConfirmAction
        trigger={
          <Button size="sm" variant="outline" disabled={busy} className="text-red-600 hover:text-red-700">
            <XCircle /> Cancel
          </Button>
        }
        title={`Cancel request #${r.id}?`}
        description={
          r.status === "ALLOCATED"
            ? `The reserved ${RESOURCE_LABELS[r.resourceType]} bed at ${r.hospitalName} will be released.`
            : "The patient will be removed from the priority queue. No bed counts change."
        }
        confirmLabel="Cancel request"
        destructive
        onConfirm={() => run(cancel, "cancelled")}
      />
    </div>
  );
}

export function RequestsTable() {
  const [status, setStatus] = useState<RequestStatus | "">("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const { data, isLoading, isError, error, refetch } = useRequests({
    status: status || undefined,
    severity: severity || undefined,
    search: search || undefined,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-4 text-teal-600" /> Emergency requests
        </CardTitle>
        <CardDescription>All requests, newest first. Discharge or cancel to release beds.</CardDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" aria-hidden />
            <Input
              aria-label="Search requests"
              placeholder="Search patient, condition, hospital or #id"
              className="pl-8"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <NativeSelect aria-label="Filter by status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value as RequestStatus | "")}>
            <option value="">All statuses</option>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by severity" className="w-40" value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {isLoading ? (
          <div className="space-y-2 px-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : isError ? (
          <div className="px-5">
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </div>
        ) : !data?.length ? (
          <EmptyState
            title={status || severity || search ? "No requests match the filters" : "No emergency requests yet"}
            description="Raise a request with the form to allocate the nearest suitable bed."
          />
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>ID</TH>
                <TH>Patient</TH>
                <TH>Severity</TH>
                <TH>Resource</TH>
                <TH>Assigned hospital</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-muted-foreground">#{r.id}</TD>
                  <TD>
                    <p className="font-medium text-slate-900">{r.patientName}</p>
                    <p className="max-w-[180px] truncate text-xs text-muted-foreground" title={r.patientCondition}>
                      {r.patientAge} yrs · {r.patientCondition}
                    </p>
                  </TD>
                  <TD>
                    <SeverityBadge severity={r.severity} />
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <ResourceIcon type={r.resourceType} /> {RESOURCE_LABELS[r.resourceType]}
                    </span>
                  </TD>
                  <TD>
                    {r.hospitalName ? (
                      <>
                        <p className="whitespace-nowrap">{r.hospitalName}</p>
                        <p className="text-xs text-muted-foreground">{formatKm(r.distanceKm)}</p>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.status === "PENDING" && r.queuePosition ? `Queue #${r.queuePosition}` : "-"}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <RequestStatusBadge status={r.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</TD>
                  <TD>
                    <RowActions r={r} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
