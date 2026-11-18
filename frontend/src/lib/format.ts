import type { ResourceType, Severity } from "@/types/api";

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  EMERGENCY: "Emergency",
  ICU: "ICU",
  VENTILATOR: "Ventilator",
  GENERAL: "General",
  OXYGEN: "Oxygen",
};

export const RESOURCE_LONG_LABELS: Record<ResourceType, string> = {
  EMERGENCY: "Emergency bed",
  ICU: "ICU bed",
  VENTILATOR: "Ventilator",
  GENERAL: "General bed",
  OXYGEN: "Oxygen-supported bed",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: "Critical",
  SERIOUS: "Serious",
  STABLE: "Stable",
};

export type AvailabilityLevel = "good" | "low" | "critical" | "none";

/** Free share in percent; 0 when there is no capacity (never divides by zero). */
export function availabilityPercent(available: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (available / total) * 100));
}

/**
 * Report section 2.1.4: green when at least 40% of units are free, amber from 15% up to 40%,
 * red below 15%. A row with zero capacity is shown as "none" (grey) rather than as a shortage.
 */
export function availabilityLevel(available: number, total: number): AvailabilityLevel {
  if (!total || total <= 0) return "none";
  const pct = availabilityPercent(available, total);
  if (pct >= 40) return "good";
  if (pct >= 15) return "low";
  return "critical";
}

export const LEVEL_BAR_CLASS: Record<AvailabilityLevel, string> = {
  good: "bg-ok",
  low: "bg-low",
  critical: "bg-crit",
  none: "bg-border",
};

export const LEVEL_TEXT_CLASS: Record<AvailabilityLevel, string> = {
  good: "text-[oklch(0.42_0.09_155)]",
  low: "text-[oklch(0.5_0.11_65)]",
  critical: "text-[oklch(0.5_0.18_27)]",
  none: "text-muted-foreground",
};

export const LEVEL_LABEL: Record<AvailabilityLevel, string> = {
  good: "Adequate",
  low: "Low",
  critical: "Critical",
  none: "No capacity",
};

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : timeFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : dateTimeFmt.format(d);
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatKm(km: number | null | undefined): string {
  return km == null ? "-" : `${km.toFixed(1)} km`;
}
