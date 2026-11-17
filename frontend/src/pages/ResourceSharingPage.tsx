import { useState } from "react";
import { ArrowRight, Check, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/form-controls";
import { Skeleton, Table, TBody, TD, TH, THead, TR } from "@/components/ui/misc";
import { ConfirmAction, EmptyState, ErrorState, PageHeader, ResourceIcon, TransferStatusBadge } from "@/components/common";
import { TransferForm } from "@/components/sharing/TransferForm";
import { useApproveTransfer, useHospitals, useRejectTransfer, useTransfers } from "@/hooks/queries";
import { RESOURCE_LABELS, RESOURCE_LONG_LABELS, formatDateTime } from "@/lib/format";
import type { Hospital, Transfer, TransferStatus } from "@/types/api";
import type { ApiError } from "@/services/api";

function Decision({ t, hospitals }: { t: Transfer; hospitals: Hospital[] }) {
  const approve = useApproveTransfer();
  const reject = useRejectTransfer();
  const busy = approve.isPending || reject.isPending;
  if (t.status !== "PENDING") {
    return <span className="text-xs text-muted-foreground">{t.resolvedAt ? formatDateTime(t.resolvedAt) : "-"}</span>;
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
              <p className={donorRow.available < t.quantity ? "font-medium text-red-600" : ""}>
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
          <Button size="sm" variant="outline" disabled={busy} className="text-red-600 hover:text-red-700">
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
    <div className="space-y-6">
      <PageHeader
        icon={Share2}
        title="Resource sharing"
        description="Hospitals request beds or equipment from each other; the donor approves or rejects."
      />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
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
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
            </NativeSelect>
          </CardHeader>
          <CardContent className="px-0">
            {transfers.isLoading ? (
              <div className="space-y-2 px-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : transfers.isError ? (
              <div className="px-5">
                <ErrorState message={(transfers.error as Error).message} onRetry={() => transfers.refetch()} />
              </div>
            ) : list.length === 0 ? (
              <EmptyState icon={Share2} title="No sharing requests" description="Requests between hospitals will be listed here." />
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
                      <TD className="font-mono text-xs text-muted-foreground">#{t.id}</TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="font-medium text-slate-900">{t.requesterHospitalName}</span>
                          <ArrowRight className="size-3.5 text-slate-400" aria-label="from donor" />
                          <span>{t.donorHospitalName}</span>
                        </div>
                        {t.note && <p className="max-w-[260px] truncate text-xs text-muted-foreground" title={t.note}>{t.note}</p>}
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <ResourceIcon type={t.resourceType} /> {RESOURCE_LABELS[t.resourceType]}
                        </span>
                      </TD>
                      <TD className="text-right font-semibold tabular-nums">{t.quantity}</TD>
                      <TD>
                        <TransferStatusBadge status={t.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</TD>
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
