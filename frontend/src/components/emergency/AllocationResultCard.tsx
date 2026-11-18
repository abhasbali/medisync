import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge, SeverityBadge } from "@/components/common";
import { RESOURCE_LONG_LABELS, formatKm } from "@/lib/format";
import { useQueue } from "@/hooks/queries";
import type { AllocationResult } from "@/types/api";
import { cn } from "@/lib/utils";

export const QUEUED_TEXT =
  "Currently no suitable bed is available. The request has been added to the priority queue.";

export function AllocationResultCard({ result, onClose }: { result: AllocationResult; onClose: () => void }) {
  const r = result.request;
  const queue = useQueue();
  // Show the live queue position (it changes as other patients are served).
  const position = queue.data ? queue.data.find((q) => q.id === r.id)?.queuePosition : r.queuePosition;

  return (
    <div
      role="status"
      className={cn("relative overflow-hidden rounded-md border bg-card", "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        result.allocated ? "before:bg-ok" : "before:bg-low")}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="eyebrow">{result.allocated ? "Bed allocated" : "Queued"}</p>
          <p className="mt-0.5 text-[13px] font-semibold text-foreground">
            {result.allocated ? r.hospitalName : QUEUED_TEXT}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="-mr-2 -mt-1 size-7" onClick={onClose} aria-label="Dismiss">
          <X />
        </Button>
      </div>

      {result.allocated ? (
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-[13px]">
          <dt className="text-muted-foreground">Area</dt>
          <dd>
            {r.hospitalArea}
            {r.hospitalPhone && <span className="num ml-2 text-muted-foreground">{r.hospitalPhone}</span>}
          </dd>
          <dt className="text-muted-foreground">Resource</dt>
          <dd>{RESOURCE_LONG_LABELS[r.resourceType]}</dd>
          <dt className="text-muted-foreground">Distance</dt>
          <dd className="num font-medium">{formatKm(r.distanceKm)}</dd>
          <dt className="text-muted-foreground">Request</dt>
          <dd className="flex items-center gap-2">
            <span className="num">#{r.id}</span> <RequestStatusBadge status={r.status} /> <SeverityBadge severity={r.severity} />
          </dd>
        </dl>
      ) : (
        <p className="px-4 py-3 text-[13px] text-muted-foreground">
          Request <span className="num">#{r.id}</span> for {r.patientName} ({RESOURCE_LONG_LABELS[r.resourceType]}) is{" "}
          {position != null ? (
            <>
              number <strong className="num text-foreground">{position}</strong> in the {RESOURCE_LONG_LABELS[r.resourceType]} queue
            </>
          ) : (
            "no longer waiting - check the requests table for its current status"
          )}
          . It will be allocated automatically when a bed is released or capacity is added.
        </p>
      )}
    </div>
  );
}
