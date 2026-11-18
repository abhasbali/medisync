import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState, SeverityBadge } from "@/components/common";
import { useQueue } from "@/hooks/queries";
import { RESOURCE_LABELS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types/api";

const RULE: Record<Severity, string> = {
  CRITICAL: "bg-crit",
  SERIOUS: "bg-low",
  STABLE: "bg-ok",
};

/** Waiting patients in dispatch order: CRITICAL > SERIOUS > STABLE, then arrival time. */
export function PriorityQueue() {
  const { data, isLoading, isError, error, refetch } = useQueue();
  const waiting = data?.length ?? 0;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Priority queue</CardTitle>
          <CardDescription>Served automatically when a matching bed is freed.</CardDescription>
        </div>
        <span className={cn("num text-lg font-medium leading-5", waiting > 0 ? "text-crit" : "text-muted-foreground")}>
          {waiting}
        </span>
      </CardHeader>
      {isLoading ? (
        <div className="p-4">
          <Skeleton className="h-20" />
        </div>
      ) : isError ? (
        <div className="p-4">
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        </div>
      ) : !data?.length ? (
        <EmptyState title="Nobody is waiting" description="Every request has been allocated a bed." className="py-6" />
      ) : (
        <ol className="divide-y" aria-label="Waiting patients in priority order">
          {data.map((r, i) => (
            <li key={r.id} className="grid grid-cols-[3px_20px_1fr_auto] items-center gap-x-3 px-4 py-2.5">
              <span className={cn("h-full min-h-8 rounded-full", RULE[r.severity])} aria-hidden />
              <span className="num text-xs text-muted-foreground" title="Overall dispatch order">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {r.patientName} <span className="num font-normal text-muted-foreground">#{r.id}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {RESOURCE_LABELS[r.resourceType]} · position <span className="num">{r.queuePosition}</span> · waiting{" "}
                  {timeAgo(r.createdAt).replace(" ago", "")}
                </p>
              </div>
              <SeverityBadge severity={r.severity} />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
