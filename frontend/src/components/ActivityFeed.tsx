import {
  ArrowLeftRight,
  BedDouble,
  CheckCircle2,
  Clock,
  LogOut,
  PlusCircle,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useActivity } from "@/hooks/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState } from "@/components/common";
import { formatTime, timeAgo } from "@/lib/format";
import type { ActivityType } from "@/types/api";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityType, { icon: LucideIcon; tone: string }> = {
  SYSTEM: { icon: Sparkles, tone: "bg-slate-100 text-slate-500" },
  REQUEST_CREATED: { icon: PlusCircle, tone: "bg-blue-50 text-blue-600" },
  ALLOCATED: { icon: BedDouble, tone: "bg-teal-50 text-teal-700" },
  QUEUED: { icon: Clock, tone: "bg-amber-50 text-amber-700" },
  DISCHARGED: { icon: LogOut, tone: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { icon: XCircle, tone: "bg-slate-100 text-slate-500" },
  INVENTORY_UPDATED: { icon: Settings2, tone: "bg-indigo-50 text-indigo-600" },
  TRANSFER_REQUESTED: { icon: ArrowLeftRight, tone: "bg-blue-50 text-blue-600" },
  TRANSFER_APPROVED: { icon: ThumbsUp, tone: "bg-emerald-50 text-emerald-700" },
  TRANSFER_REJECTED: { icon: ThumbsDown, tone: "bg-red-50 text-red-600" },
};

export function ActivityFeed({ limit = 30, className }: { limit?: number; className?: string }) {
  const { data, isLoading, isError, error, refetch } = useActivity(limit);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse-dot" aria-hidden />
          Live activity
        </CardTitle>
        <CheckCircle2 className="size-4 text-slate-300" aria-hidden />
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pr-3" style={{ maxHeight: 640 }}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
        ) : !data?.length ? (
          <EmptyState title="No activity yet" description="Allocations, discharges and transfers will appear here." />
        ) : (
          <ol className="space-y-1" aria-label="Activity log">
            {data.map((a) => {
              const { icon: Icon, tone } = ICONS[a.actionType] ?? ICONS.SYSTEM;
              return (
                <li key={a.id} className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50">
                  <div className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", tone)}>
                    <Icon className="size-3.5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-slate-700">{a.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <time dateTime={a.createdAt}>{formatTime(a.createdAt)}</time> · {timeAgo(a.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
