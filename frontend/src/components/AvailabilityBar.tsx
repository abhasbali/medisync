import { Progress } from "@/components/ui/misc";
import { ResourceIcon } from "@/components/common";
import {
  LEVEL_BAR_CLASS,
  LEVEL_LABEL,
  RESOURCE_LABELS,
  availabilityLevel,
  availabilityPercent,
} from "@/lib/format";
import type { ResourceType } from "@/types/api";

/** One resource row: icon, label, colour-coded bar and available/total (report thresholds 40% / 15%). */
export function AvailabilityBar({
  type,
  available,
  total,
}: {
  type: ResourceType;
  available: number;
  total: number;
}) {
  const level = availabilityLevel(available, total);
  const pct = availabilityPercent(available, total);
  return (
    <div className="grid grid-cols-[1.25rem_5.5rem_1fr_auto] items-center gap-2" title={`${LEVEL_LABEL[level]} - ${Math.round(pct)}% free`}>
      <ResourceIcon type={type} />
      <span className="text-sm text-slate-600">{RESOURCE_LABELS[type]}</span>
      <Progress
        value={pct}
        indicatorClassName={LEVEL_BAR_CLASS[level]}
        label={`${RESOURCE_LABELS[type]}: ${available} of ${total} available`}
      />
      <span className="min-w-[4.5rem] text-right text-sm tabular-nums">
        <span className="font-semibold text-slate-900">{available}</span>
        <span className="text-slate-400">/{total}</span>
      </span>
    </div>
  );
}
