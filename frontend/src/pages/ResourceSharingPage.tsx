import { useState } from "react";
import { ArrowRight, Check, Download, X } from "lucide-react";
import { downloadCsv, stamp } from "@/lib/csv";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-controls";
import { Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { ConfirmAction, EmptyState, ErrorState, PageHeader, TransferStatusBadge } from "@/components/common";
import { TransferForm } from "@/components/sharing/TransferForm";
import { useApproveTransfer, useHospitals, useRejectTransfer, useTransfers } from "@/hooks/queries";
import { RESOURCE_LABELS, RESOURCE_LONG_LABELS, formatDateTime } from "@/lib/format";
import type { Hospital, Transfer, TransferStatus } from "@/types/api";
import type { ApiError } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

function Decision({ t, hospitals }: { t: Transfer; hospitals: Hospital[] }) {
  const approve = useApproveTransfer();
  const reject = useRejectTransfer();
  const { canManageHospital } = useAuth();
  const busy = approve.isPending || reject.isPending;
  if (t.status !== "PENDING") {
    return <span className="text-xs text-muted-foreground">{t.resolvedAt ? formatDateTime(t.resolvedAt) : "-"}</span>;
  }
  if (!canManageHospital(t.donorHospitalId)) {
    return <span className="text-xs text-muted-foreground">Awaiting donor decision</span>;
  }
  const donorRow = hospitals.find((h) => h.id === t.donorHospitalId)?.inventory.find((i) => i.resourceType === t.resourceType);
  return (
    <div className="flex justify-end gap-1.5">
      <ConfirmAction
        trigger={
          <Button size="sm" variant="success" disabled={busy}>
            <Check /> Approve
          </Button>
        }
        title={`Approve transfer #${t.id}?`}
        description={
          <div className="space-y-2">
            <p>
              {t.donorHospitalName} will give <strong>{t.quantity}</strong> {RESOURCE_LONG_LABELS[t.resourceType]}
              {t.quantity > 1 ? "s" : ""} to {t.requesterHospitalName}. Both the total and available counts move
              together in one transaction.
            </p>
            {donorRow && (
              <p className={donorRow.available < t.quantity ? "font-medium text-crit" : ""}>
                Donor currently has {donorRow.available} free of {donorRow.total}.
              </p>
            )}
          </div>
        }
        confirmLabel="Approve transfer"
        onConfirm={() =>
          approve.mutate(t.id, {
            onSuccess: () => toast.success(`Transfer #${t.id} approved - capacity moved`),
            onError: (e) => toast.error((e as ApiError).message, { duration: 7000 }),
          })
        }
      />
      <ConfirmAction
        trigger={
          <Button size="sm" variant="outline" disabled={busy} className="text-crit hover:text-crit">
            <X /> Reject
          </Button>
        }
        title={`Reject transfer #${t.id}?`}
        description="Only the status changes; no inventory counts are modified."
        confirmLabel="Reject"
        destructive
        onConfirm={() =>
          reject.mutate(t.id, {
            onSuccess: () => toast.success(`Transfer #${t.id} rejected`),
            onError: (e) => toast.error((e as ApiError).message),
          })
        }
      />
    </div>
  );
}

export function ResourceSharingPage() {
  const hospitals = useHospitals();
  const transfers = useTransfers();
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const list = (transfers.data ?? []).filter((t) => !statusFilter || t.status === statusFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transfers"
        description="Hospitals request beds or equipment from each other; the donor approves or rejects."
      />
      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Request resources</CardTitle>
            <CardDescription>Created as PENDING until the donor decides.</CardDescription>
          </CardHeader>
          <CardContent>
            {hospitals.isLoading ? (
              <Skeleton className="h-80" />
            ) : hospitals.isError ? (
              <ErrorState message={(hospitals.error as Error).message} onRetry={() => hospitals.refetch()} />
            ) : (
              <TransferForm hospitals={hospitals.data ?? []} />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Sharing requests</CardTitle>
              <CardDescription>Approve or reject pending requests as the donor hospital.</CardDescription>
            </div>
            <NativeSelect
              aria-label="Filter transfers by status"
              className="w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TransferStatus | "")}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </NativeSelect>
            <Button
              variant="outline"
              disabled={!list.length}
              onClick={() =>
                downloadCsv(
                  `medisync-transfers-${stamp()}.csv`,
                  ["id", "requester", "donor", "resource", "quantity", "status", "note", "created_at", "resolved_at"],
                  list.map((t) => [t.id, t.requesterHospitalName, t.donorHospitalName, t.resourceType, t.quantity, t.status, t.note, t.createdAt, t.resolvedAt]),
                )
              }
            >
              <Download /> Export CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {transfers.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : transfers.isError ? (
              <div className="p-4">
                <ErrorState message={(transfers.error as Error).message} onRetry={() => transfers.refetch()} />
              </div>
            ) : list.length === 0 ? (
              <EmptyState title="No sharing requests" description="Requests between hospitals will be listed here." />
            ) : (
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>ID</TH>
                    <TH>Requester → Donor</TH>
                    <TH>Resource</TH>
                    <TH className="text-right">Qty</TH>
                    <TH>Status</TH>
                    <TH>Requested</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {list.map((t) => (
                    <TR key={t.id}>
                      <TD className="num text-xs text-muted-foreground">{t.id}</TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-foreground">{t.requesterHospitalName}</span>
                          <ArrowRight className="size-3.5 text-muted-foreground" aria-label="from donor" />
                          <span>{t.donorHospitalName}</span>
                        </div>
                        {t.note && <p className="max-w-[260px] truncate text-xs text-muted-foreground" title={t.note}>{t.note}</p>}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          {RESOURCE_LABELS[t.resourceType]}
                        </span>
                      </TD>
                      <TD className="num text-right font-medium">{t.quantity}</TD>
                      <TD>
                        <TransferStatusBadge status={t.status} />
                      </TD>
                      <TD className="num whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TD>
                      <TD>
                        <Decision t={t} hospitals={hospitals.data ?? []} />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
