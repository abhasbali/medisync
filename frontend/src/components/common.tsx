import type { ReactNode } from "react";
import {
  AlertTriangle,
  BedDouble,
  BedSingle,
  HeartPulse,
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
  return <Icon className={cn("size-3.5 text-muted-foreground", className)} aria-hidden />;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const variant = severity === "CRITICAL" ? "critical" : severity === "SERIOUS" ? "serious" : "stable";
  return (
    <Badge variant={variant}>
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

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={REQUEST_STATUS_VARIANT[status]}>{titleCase(status)}</Badge>;
}

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const variant = status === "APPROVED" ? "stable" : status === "REJECTED" ? "muted" : "serious";
  return <Badge variant={variant}>{titleCase(status)}</Badge>;
}

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1 px-4 py-10 text-center", className)}>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-sm border border-crit/30 bg-crit/5 px-3 py-2.5">
      <AlertTriangle className="size-4 shrink-0 text-crit" aria-hidden />
      <p className="flex-1 text-[13px] text-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw /> Retry
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

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      {actions}
    </div>
  );
}
