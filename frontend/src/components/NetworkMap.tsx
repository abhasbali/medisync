import { useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { useHospitals } from "@/hooks/queries";
import { LEVEL_LABEL, RESOURCE_LABELS, availabilityLevel, availabilityPercent, type AvailabilityLevel } from "@/lib/format";
import { RESOURCE_TYPES, type Hospital, type ResourceType } from "@/types/api";
import { cn } from "@/lib/utils";

const FILL: Record<AvailabilityLevel, string> = {
  good: "var(--ok)",
  low: "var(--low)",
  critical: "var(--crit)",
  none: "var(--border)",
};

const W = 560;
const H = 340;
const PAD = 48;

/**
 * Schematic network map: hospitals placed by real latitude/longitude (equirectangular, fit to bounds),
 * marker size = capacity, colour = free-capacity level for the selected resource.
 */
export function NetworkMap() {
  const { data, isLoading } = useHospitals();
  const [type, setType] = useState<ResourceType | "ALL">("ALL");
  const [hover, setHover] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!data?.length) return [];
    const lats = data.map((h) => h.latitude);
    const lngs = data.map((h) => h.longitude);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const spanX = Math.max((maxLng - minLng) * Math.cos(midLat), 1e-6);
    const spanY = Math.max(maxLat - minLat, 1e-6);
    const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
    const offX = (W - spanX * scale) / 2;
    const offY = (H - spanY * scale) / 2;
    const maxCap = Math.max(...data.map((h) => h.totalCapacity), 1);
    return data.map((h) => {
      const { available, total } = pick(h, type);
      return {
        h,
        x: offX + (h.longitude - minLng) * Math.cos(midLat) * scale,
        y: offY + (maxLat - h.latitude) * scale,
        r: 7 + 11 * Math.sqrt(h.totalCapacity / maxCap),
        available,
        total,
        level: availabilityLevel(available, total),
      };
    });
  }, [data, type]);

  const active = points.find((p) => p.h.id === hover);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Network map</CardTitle>
          <CardDescription>Hospitals by location. Marker size is capacity; colour is free share.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-px rounded-sm border bg-border" role="group" aria-label="Map resource">
          {(["ALL", ...RESOURCE_TYPES] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "px-2 py-1 text-[11px] font-medium",
                type === t ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "ALL" ? "All" : RESOURCE_LABELS[t]}
            </button>
          ))}
        </div>
      </CardHeader>
      <div className="relative">
        {isLoading ? (
          <Skeleton className="m-4 h-[300px]" />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Map of hospitals">
            <defs>
              <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="var(--border)" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" />
            {points.map((p) => (
              <g
                key={p.h.id}
                onMouseEnter={() => setHover(p.h.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.h.id)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${p.h.name}: ${p.available} of ${p.total} free`}
                style={{ cursor: "default", outline: "none" }}
              >
                <circle cx={p.x} cy={p.y} r={p.r} fill={FILL[p.level]} fillOpacity={0.18} stroke={FILL[p.level]} strokeWidth={1.5} />
                <circle cx={p.x} cy={p.y} r={3} fill={FILL[p.level]} />
                <text x={p.x + p.r + 5} y={p.y - 2} fontSize="11" fontWeight={600} fill="var(--foreground)">
                  {p.h.name}
                </text>
                <text x={p.x + p.r + 5} y={p.y + 11} fontSize="10" fontFamily="IBM Plex Mono" fill="var(--muted-foreground)">
                  {p.available}/{p.total} free
                </text>
              </g>
            ))}
          </svg>
        )}
        {active && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-sm border bg-card px-3 py-2 text-xs shadow-sm">
            <p className="font-semibold text-foreground">{active.h.name}</p>
            <p className="text-muted-foreground">
              {active.h.area} · {LEVEL_LABEL[active.level]} ·{" "}
              <span className="num">{Math.round(availabilityPercent(active.available, active.total))}%</span> free
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function pick(h: Hospital, type: ResourceType | "ALL") {
  if (type === "ALL") return { available: h.totalAvailable, total: h.totalCapacity };
  const row = h.inventory.find((i) => i.resourceType === type);
  return { available: row?.available ?? 0, total: row?.total ?? 0 };
}
