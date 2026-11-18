import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import { Progress, Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState, PageHeader } from "@/components/common";
import { useHospitalInventory, useHospitals, useUpdateInventory } from "@/hooks/queries";
import {
  LEVEL_BAR_CLASS,
  LEVEL_LABEL,
  LEVEL_TEXT_CLASS,
  RESOURCE_LONG_LABELS,
  availabilityLevel,
  availabilityPercent,
  formatDateTime,
} from "@/lib/format";
import type { Inventory } from "@/types/api";
import type { ApiError } from "@/services/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

/** Client-side mirror of the server rules; the server re-checks everything. */
export function validateCounts(totalRaw: string, availableRaw: string, activeAllocations: number): string | null {
  if (!/^\d+$/.test(totalRaw.trim()) || !/^\d+$/.test(availableRaw.trim())) {
    return "Counts must be whole numbers of zero or more";
  }
  const total = Number(totalRaw);
  const available = Number(availableRaw);
  if (available > total) return "Available cannot exceed total";
  if (total - available < activeAllocations) {
    return `${activeAllocations} patient(s) are allocated here; at least ${activeAllocations} unit(s) must stay occupied`;
  }
  return null;
}

function InventoryRow({ row }: { row: Inventory }) {
  const update = useUpdateInventory();
  const [total, setTotal] = useState(String(row.total));
  const [available, setAvailable] = useState(String(row.available));
  const [serverError, setServerError] = useState<string | null>(null);

  // When the row changes on the server (another window, an allocation), refresh the inputs.
  useEffect(() => {
    setTotal(String(row.total));
    setAvailable(String(row.available));
  }, [row.total, row.available]);

  const dirty = total !== String(row.total) || available !== String(row.available);
  const error = dirty ? validateCounts(total, available, row.activeAllocations) : null;
  const level = availabilityLevel(row.available, row.total);

  const save = () => {
    setServerError(null);
    update.mutate(
      { id: row.id, body: { total: Number(total), available: Number(available) } },
      {
        onSuccess: (r) => toast.success(`${RESOURCE_LONG_LABELS[r.resourceType]} saved: ${r.available}/${r.total}`),
        onError: (e) => {
          setServerError((e as ApiError).message);
          toast.error((e as ApiError).message);
        },
      },
    );
  };

  const fieldId = `inv-${row.id}`;
  return (
    <div className="grid gap-3 border-b px-4 py-3.5 last:border-0 md:grid-cols-[240px_minmax(0,320px)_1fr] md:items-start">
      <div>
        <p className="text-[13px] font-medium text-foreground">{RESOURCE_LONG_LABELS[row.resourceType]}</p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={availabilityPercent(row.available, row.total)} indicatorClassName={LEVEL_BAR_CLASS[level]} className="w-24" label="Current availability" />
          <span className="num text-xs">
            {row.available}/{row.total}
          </span>
          <span className={cn("text-xs", LEVEL_TEXT_CLASS[level])}>{LEVEL_LABEL[level]}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Updated {formatDateTime(row.updatedAt)}
          {row.activeAllocations > 0 && ` · ${row.activeAllocations} active allocation(s)`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-total`}>Total units</Label>
          <Input
            id={`${fieldId}-total`}
            inputMode="numeric"
            className="num"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-available`}>Available units</Label>
          <Input
            id={`${fieldId}-available`}
            inputMode="numeric"
            className="num"
            value={available}
            onChange={(e) => setAvailable(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </div>
        {(error || serverError) && (
          <p role="alert" className="col-span-2 text-xs font-medium text-destructive">
            {error ?? serverError}
          </p>
        )}
      </div>
      <Button onClick={save} disabled={!dirty || !!error || update.isPending} variant={dirty ? "default" : "outline"} className="md:mt-[18px] md:w-24 md:justify-self-end">
        {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        Save
      </Button>
    </div>
  );
}

export function HospitalAdminPage() {
  const hospitals = useHospitals();
  const { user } = useAuth();
  const lockedHospital = user?.role === "HOSPITAL_STAFF" ? user.hospitalId : null;
  const [hospitalId, setHospitalId] = useState<number | null>(lockedHospital);

  useEffect(() => {
    if (hospitalId == null && hospitals.data?.length) setHospitalId(hospitals.data[0].id);
  }, [hospitals.data, hospitalId]);

  const inventory = useHospitalInventory(hospitalId);
  const hospital = hospitals.data?.find((h) => h.id === hospitalId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        description="Maintain total and available units per resource. Each row saves on its own."
        actions={
          <div className="flex min-w-[240px] flex-col gap-1.5">
            <Label htmlFor="admin-hospital">Hospital</Label>
            <NativeSelect
              id="admin-hospital"
              value={hospitalId ?? ""}
              onChange={(e) => setHospitalId(e.target.value ? Number(e.target.value) : null)}
              disabled={lockedHospital != null}
              title={lockedHospital != null ? "Hospital staff can only manage their own hospital" : undefined}
            >
              {hospitals.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{hospital?.name ?? "Select a hospital"}</CardTitle>
          <CardDescription>
            {hospital ? (
              <>
                {hospital.area} · <span className="num">{hospital.phone}</span>
              </>
            ) : (
              "Choose the hospital whose inventory you maintain."
            )}
          </CardDescription>
        </CardHeader>
        <div>
          {hospitals.isError ? (
            <div className="p-4">
              <ErrorState message={(hospitals.error as Error).message} onRetry={() => hospitals.refetch()} />
            </div>
          ) : inventory.isLoading || hospitals.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : inventory.isError ? (
            <div className="p-4">
              <ErrorState message={(inventory.error as Error).message} onRetry={() => inventory.refetch()} />
            </div>
          ) : !inventory.data?.length ? (
            <EmptyState title="No inventory rows" description="This hospital has no resources recorded." />
          ) : (
            inventory.data.map((row) => <InventoryRow key={row.id} row={row} />)
          )}
        </div>
        <p className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Counts are whole numbers ≥ 0 and available ≤ total. Occupied units (total − available) can never be fewer than
          the patients allocated here. Added free capacity is offered to waiting patients immediately.
        </p>
      </Card>
    </div>
  );
}
