import { CheckCircle2, Clock, MapPin, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge, ResourceIcon, SeverityBadge } from "@/components/common";
import { RESOURCE_LONG_LABELS, formatKm } from "@/lib/format";
import { useQueue } from "@/hooks/queries";
import type { AllocationResult } from "@/types/api";

export const QUEUED_TEXT =
  "Currently no suitable bed is available. The request has been added to the priority queue.";

export function AllocationResultCard({ result, onClose }: { result: AllocationResult; onClose: () => void }) {
  const r = result.request;
  const queue = useQueue();
  // Show the live queue position (it changes as other patients are served).
  const position = queue.data ? queue.data.find((q) => q.id === r.id)?.queuePosition : r.queuePosition;
  const live = position != null ? { queuePosition: position } : undefined;

  if (result.allocated) {
    return (
      <div role="status" className="relative rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
        <Button variant="ghost" size="icon" className="absolute right-2 top-2 size-7" onClick={onClose} aria-label="Dismiss">
          <X />
        </Button>
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="size-5" aria-hidden />
          <p className="font-semibold">Bed allocated successfully</p>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Hospital</dt>
          <dd className="font-semibold text-slate-900">{r.hospitalName}</dd>
          <dt className="text-muted-foreground">Area</dt>
          <dd className="inline-flex items-center gap-1">
            <MapPin className="size-3.5 text-slate-400" /> {r.hospitalArea}
            {r.hospitalPhone && (
              <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                <Phone className="size-3.5" /> {r.hospitalPhone}
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Resource</dt>
          <dd className="inline-flex items-center gap-1.5">
            <ResourceIcon type={r.resourceType} /> {RESOURCE_LONG_LABELS[r.resourceType]}
          </dd>
          <dt className="text-muted-foreground">Distance</dt>
          <dd className="font-semibold tabular-nums">{formatKm(r.distanceKm)}</dd>
          <dt className="text-muted-foreground">Request</dt>
          <dd className="flex items-center gap-2">
            #{r.id} <RequestStatusBadge status={r.status} /> <SeverityBadge severity={r.severity} />
          </dd>
        </dl>
      </div>
    );
  }

  return (
    <div role="status" className="relative rounded-xl border border-amber-200 bg-amber-50/80 p-4">
      <Button variant="ghost" size="icon" className="absolute right-2 top-2 size-7" onClick={onClose} aria-label="Dismiss">
        <X />
      </Button>
      <div className="flex items-start gap-2 pr-8 text-amber-900">
        <Clock className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="font-semibold">{QUEUED_TEXT}</p>
      </div>
      <p className="mt-2 text-sm text-amber-900/80">
        Request #{r.id} for {r.patientName} ({RESOURCE_LONG_LABELS[r.resourceType]}) is{" "}
        {live ? (
          <>
            number <strong>{live.queuePosition}</strong> in the {RESOURCE_LONG_LABELS[r.resourceType]} queue
          </>
        ) : (
          "no longer waiting - check the requests table for its current status"
        )}
        . It will be allocated automatically when a bed is released or capacity is added.
      </p>
    </div>
  );
}
