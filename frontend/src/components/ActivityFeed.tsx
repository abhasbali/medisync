import { useActivity } from "@/hooks/queries";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/common";
import { timeAgo } from "@/lib/format";
import type { ActivityType } from "@/types/api";
import { cn } from "@/lib/utils";

const hhmm = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Only events that change patient outcome get colour; everything else is neutral. */
const MARK: Record<ActivityType, string> = {
  SYSTEM: "bg-border",
  REQUEST_CREATED: "bg-border",
  ALLOCATED: "bg-primary",
  QUEUED: "bg-low",
  DISCHARGED: "bg-ok",
  CANCELLED: "bg-border",
  INVENTORY_UPDATED: "bg-border",
  TRANSFER_REQUESTED: "bg-border",
  TRANSFER_APPROVED: "bg-ok",
  TRANSFER_REJECTED: "bg-crit",
  USER_MANAGEMENT: "bg-border",
};

export function ActivityFeed({ limit = 30, className }: { limit?: number; className?: string }) {
  const { data, isLoading, isError, error, refetch } = useActivity(limit);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Activity log</CardTitle>
        <span className="text-[11px] text-muted-foreground">Last {limit}</span>
      </CardHeader>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: 640 }}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          </div>
        ) : !data?.length ? (
          <EmptyState title="No activity yet" description="Allocations, discharges and transfers will appear here." />
        ) : (
          <ol className="divide-y" aria-label="Activity log">
            {data.map((a) => (
              <li key={a.id} className="grid grid-cols-[3px_52px_1fr] gap-x-3 px-4 py-2.5">
                <span className={cn("rounded-full", MARK[a.actionType] ?? "bg-border")} aria-hidden />
                <time dateTime={a.createdAt} title={timeAgo(a.createdAt)} className="num pt-px text-[11px] text-muted-foreground">
                  {hhmm.format(new Date(a.createdAt))}
                </time>
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-foreground">{a.message}</p>
                  {a.actor && <p className="mt-0.5 text-[11px] text-muted-foreground">{a.actor}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}
