import { useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, NativeSelect } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/misc";
import { useHospitals, useQueue } from "@/hooks/queries";
import { SAMPLE_AREAS } from "@/lib/areas";
import { haversineKm } from "@/lib/chart";
import { LEVEL_TEXT_CLASS, RESOURCE_LABELS, availabilityLevel } from "@/lib/format";
import { RESOURCE_TYPES, type ResourceType } from "@/types/api";
import { cn } from "@/lib/utils";

/**
 * Dispatcher tool: "where can this patient go right now?" Ranks hospitals for a resource by
 * straight-line distance from an area, showing free units, and how many patients are already waiting.
 */
export function CapacityFinder() {
  const hospitals = useHospitals();
  const queue = useQueue();
  const [area, setArea] = useState(SAMPLE_AREAS[0].name);
  const [type, setType] = useState<ResourceType>("ICU");

  const origin = SAMPLE_AREAS.find((a) => a.name === area)!;
  const ranked = useMemo(
    () =>
      (hospitals.data ?? [])
        .map((h) => {
          const row = h.inventory.find((i) => i.resourceType === type);
          return {
            h,
            free: row?.available ?? 0,
            total: row?.total ?? 0,
            km: haversineKm(origin.latitude, origin.longitude, h.latitude, h.longitude),
          };
        })
        .sort((a, b) => (a.free > 0 ? 0 : 1) - (b.free > 0 ? 0 : 1) || a.km - b.km),
    [hospitals.data, type, origin],
  );
  const waiting = (queue.data ?? []).filter((q) => q.resourceType === type).length;
  const best = ranked.find((r) => r.free > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacity finder</CardTitle>
        <CardDescription>Nearest hospitals with a free bed, before you raise a request.</CardDescription>
      </CardHeader>
      <div className="grid grid-cols-2 gap-3 border-b px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cf-area">From area</Label>
          <NativeSelect id="cf-area" value={area} onChange={(e) => setArea(e.target.value)}>
            {SAMPLE_AREAS.map((a) => (
              <option key={a.name}>{a.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cf-type">Resource</Label>
          <NativeSelect id="cf-type" value={type} onChange={(e) => setType(e.target.value as ResourceType)}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {hospitals.isLoading ? (
        <div className="p-4">
          <Skeleton className="h-32" />
        </div>
      ) : (
        <>
          <p className="border-b bg-background/60 px-4 py-2 text-xs text-muted-foreground">
            {best ? (
              <>
                Best match: <span className="font-medium text-foreground">{best.h.name}</span>,{" "}
                <span className="num">{best.km.toFixed(1)} km</span>
              </>
            ) : (
              <span className="text-crit">No free {RESOURCE_LABELS[type]} anywhere - a new request will be queued.</span>
            )}
            {waiting > 0 && (
              <>
                {" "}
                · <span className="num">{waiting}</span> already waiting
              </>
            )}
          </p>
          <ol className="divide-y">
            {ranked.map((r, i) => {
              const level = availabilityLevel(r.free, r.total);
              return (
                <li key={r.h.id} className={cn("grid grid-cols-[16px_1fr_auto_auto] items-center gap-3 px-4 py-2", r.free === 0 && "opacity-45")}>
                  <span className="num text-[11px] text-muted-foreground">{i + 1}</span>
                  <span className="truncate text-[13px]">{r.h.name}</span>
                  <span className="num text-xs text-muted-foreground">{r.km.toFixed(1)} km</span>
                  <span className={cn("num w-12 text-right text-[13px] font-medium", r.free === 0 ? "text-muted-foreground" : LEVEL_TEXT_CLASS[level])}>
                    {r.free} free
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}
