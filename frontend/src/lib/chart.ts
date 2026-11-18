/** Chart palette - mirrors the CSS tokens in index.css (Recharts needs concrete colours). */
export const C = {
  primary: "#2b4a8c",
  primarySoft: "#9fb0d6",
  ok: "#3f8f5f",
  low: "#d39a2c",
  crit: "#c4402f",
  gray: "#d4d6dc",
  grid: "#ececef",
  axis: "#6b6f7b",
  axisMuted: "#9a9ea8",
};

export const SEVERITY_COLOR = { CRITICAL: C.crit, SERIOUS: C.low, STABLE: C.ok } as const;

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: C.axis, fontSize: 11 },
} as const;

export const numAxisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: C.axisMuted, fontSize: 11, fontFamily: "IBM Plex Mono" },
} as const;

export const tooltipProps = {
  cursor: { fill: "rgba(0,0,0,0.03)" },
  contentStyle: { borderRadius: 4, border: "1px solid #e4e5e9", fontSize: 12, boxShadow: "none" },
} as const;

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export const minutesBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function fmtMinutes(m: number | null): string {
  if (m == null) return "-";
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  return `${(m / 60).toFixed(1)} h`;
}
