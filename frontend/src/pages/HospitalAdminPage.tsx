import { useEffect, useState } from "react";
import { Building2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import { Progress, Skeleton } from "@/components/ui/misc";
import { EmptyState, ErrorState, PageHeader, ResourceIcon } from "@/components/common";
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
    <div className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-[200px_1fr_auto] md:items-center">
      <div>
        <p className="flex items-center gap-2 font-medium text-slate-900">
          <ResourceIcon type={row.resourceType} /> {RESOURCE_LONG_LABELS[row.resourceType]}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={availabilityPercent(row.available, row.total)} indicatorClassName={LEVEL_BAR_CLASS[level]} className="w-28" label="Current availability" />
          <span className={cn("text-xs font-semibold", LEVEL_TEXT_CLASS[level])}>{LEVEL_LABEL[level]}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
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
      <Button onClick={save} disabled={!dirty || !!error || update.isPending} className="md:w-28">
        {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
        Save
      </Button>
    </div>
  );
}

export function HospitalAdminPage() {
  const hospitals = useHospitals();
  const [hospitalId, setHospitalId] = useState<number | null>(null);

  useEffect(() => {
    if (hospitalId == null && hospitals.data?.length) setHospitalId(hospitals.data[0].id);
  }, [hospitals.data, hospitalId]);

  const inventory = useHospitalInventory(hospitalId);
  const hospital = hospitals.data?.find((h) => h.id === hospitalId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Hospital admin"
        description="Maintain the total and available count of each resource. Every row is saved on its own."
      />
      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-4">
          <div>
            <CardTitle>{hospital?.name ?? "Select a hospital"}</CardTitle>
            <CardDescription>
              {hospital ? `${hospital.area} · ${hospital.phone}` : "Choose the hospital whose inventory you maintain."}
            </CardDescription>
          </div>
          <div className="flex min-w-[240px] flex-col gap-1.5">
            <Label htmlFor="admin-hospital">Hospital</Label>
            <NativeSelect
              id="admin-hospital"
              value={hospitalId ?? ""}
              onChange={(e) => setHospitalId(e.target.value ? Number(e.target.value) : null)}
            >
              {hospitals.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {hospitals.isError ? (
            <ErrorState message={(hospitals.error as Error).message} onRetry={() => hospitals.refetch()} />
          ) : inventory.isLoading || hospitals.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : inventory.isError ? (
            <ErrorState message={(inventory.error as Error).message} onRetry={() => inventory.refetch()} />
          ) : !inventory.data?.length ? (
            <EmptyState title="No inventory rows" description="This hospital has no resources recorded." />
          ) : (
            inventory.data.map((row) => <InventoryRow key={row.id} row={row} />)
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Rules: counts are whole numbers ≥ 0, available ≤ total, and occupied units (total − available) can never be
            fewer than the patients the system has allocated here. Added free capacity is offered to waiting patients
            immediately.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
