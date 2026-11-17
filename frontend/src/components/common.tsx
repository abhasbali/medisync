import type { ReactNode } from "react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  BedDouble,
  BedSingle,
  HeartPulse,
  Inbox,
  RefreshCw,
  Siren,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SEVERITY_LABELS } from "@/lib/format";
import type { RequestStatus, ResourceType, Severity, TransferStatus } from "@/types/api";
import { cn } from "@/lib/utils";

export const RESOURCE_ICONS: Record<ResourceType, LucideIcon> = {
  EMERGENCY: Siren,
  ICU: HeartPulse,
  VENTILATOR: Wind,
  GENERAL: BedSingle,
  OXYGEN: BedDouble,
};

export function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const Icon = RESOURCE_ICONS[type];
  return <Icon className={cn("size-4 text-slate-500", className)} aria-hidden />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const variant = severity === "CRITICAL" ? "critical" : severity === "SERIOUS" ? "serious" : "stable";
  return (
    <Badge variant={variant}>
      {severity === "CRITICAL" && <AlertTriangle className="size-3" aria-hidden />}
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

const REQUEST_STATUS_VARIANT: Record<RequestStatus, "info" | "serious" | "muted" | "stable"> = {
  ALLOCATED: "info",
  PENDING: "serious",
  DISCHARGED: "stable",
  CANCELLED: "muted",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={REQUEST_STATUS_VARIANT[status]}>{status}</Badge>;
}

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const variant = status === "APPROVED" ? "stable" : status === "REJECTED" ? "muted" : "serious";
  return <Badge variant={variant}>{status}</Badge>;
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-10 text-center", className)}>
      <div className="rounded-full bg-slate-100 p-3">
        <Icon className="size-5 text-slate-400" aria-hidden />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50/60 px-4 py-8 text-center"
    >
      <AlertTriangle className="size-6 text-red-500" aria-hidden />
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

/** Button that asks for confirmation in a dialog before running the action. */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction destructive={destructive} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PageHeader({ title, description, icon: Icon = ActivityIcon }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-teal-50 p-2 text-teal-700 ring-1 ring-teal-100">
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
