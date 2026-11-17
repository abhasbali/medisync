import { ListOrdered } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState, ResourceIcon, SeverityBadge } from "@/components/common";
import { useQueue } from "@/hooks/queries";
import { RESOURCE_LABELS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types/api";

const STRIPE: Record<Severity, string> = {
  CRITICAL: "border-l-red-500 bg-red-50/40",
  SERIOUS: "border-l-amber-500 bg-amber-50/40",
  STABLE: "border-l-emerald-500 bg-emerald-50/30",
};

/** Waiting patients in dispatch order: CRITICAL > SERIOUS > STABLE, then arrival time. */
export function PriorityQueue() {
  const { data, isLoading, isError, error, refetch } = useQueue();
  return (
    <Card className="border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListOrdered className="size-4 text-amber-600" /> Priority queue
          {data && data.length > 0 && (
            <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">{data.length}</span>
          )}
        </CardTitle>
        <CardDescription>Served automatically when a matching bed is freed.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : !data?.length ? (
          <EmptyState icon={ListOrdered} title="Nobody is waiting" description="Every request has been allocated a bed." className="py-6" />
        ) : (
          <ol className="space-y-2" aria-label="Waiting patients in priority order">
            {data.map((r, i) => (
              <li key={r.id} className={cn("flex items-center gap-3 rounded-lg border border-l-4 p-2.5", STRIPE[r.severity])}>
                <span
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 ring-1 ring-slate-200"
                  title="Overall dispatch order"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {r.patientName} <span className="font-normal text-muted-foreground">#{r.id}</span>
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ResourceIcon type={r.resourceType} className="size-3" /> {RESOURCE_LABELS[r.resourceType]} queue #
                    {r.queuePosition} · waiting {timeAgo(r.createdAt).replace(" ago", "")}
                  </p>
                </div>
                <SeverityBadge severity={r.severity} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
