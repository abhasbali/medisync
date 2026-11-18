import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Crosshair, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { useCreateRequest } from "@/hooks/queries";
import { ApiError } from "@/services/api";
import { SAMPLE_AREAS, findArea } from "@/lib/areas";
import { RESOURCE_LONG_LABELS, SEVERITY_LABELS } from "@/lib/format";
import { RESOURCE_TYPES, SEVERITIES, type AllocationResult } from "@/types/api";

const numberIn = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => v !== "" && !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => Number(v) >= min && Number(v) <= max, `${label} must be between ${min} and ${max}`);

export const emergencySchema = z.object({
  patientName: z.string().trim().min(1, "Patient name is required").max(100, "At most 100 characters"),
  patientAge: z
    .string()
    .trim()
    .min(1, "Patient age is required")
    .refine((v) => /^\d+$/.test(v), "Age must be a whole number")
    .refine((v) => Number(v) <= 130, "Age must be between 0 and 130"),
  patientCondition: z.string().trim().min(1, "Medical condition is required").max(255, "At most 255 characters"),
  severity: z.enum(SEVERITIES, { errorMap: () => ({ message: "Select a severity" }) }),
  resourceType: z.enum(RESOURCE_TYPES, { errorMap: () => ({ message: "Select the required resource" }) }),
  area: z.string(),
  latitude: numberIn("Latitude", -90, 90),
  longitude: numberIn("Longitude", -180, 180),
});

export type EmergencyFormValues = z.infer<typeof emergencySchema>;

const DEFAULTS: EmergencyFormValues = {
  patientName: "",
  patientAge: "",
  patientCondition: "",
  severity: "CRITICAL",
  resourceType: "ICU",
  area: "",
  latitude: "",
  longitude: "",
};

export function EmergencyForm({ onResult }: { onResult: (r: AllocationResult) => void }) {
  const create = useCreateRequest();
  const [locating, setLocating] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<EmergencyFormValues>({ resolver: zodResolver(emergencySchema), defaultValues: DEFAULTS });

  const areaField = register("area", {
    onChange: (e) => {
      const area = findArea(e.target.value);
      if (area) {
        setValue("latitude", area.latitude.toFixed(4), { shouldValidate: true });
        setValue("longitude", area.longitude.toFixed(4), { shouldValidate: true });
      }
    },
  });

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("This browser does not support geolocation. Choose an area or type the coordinates.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setValue("area", "");
        setValue("latitude", pos.coords.latitude.toFixed(6), { shouldValidate: true });
        setValue("longitude", pos.coords.longitude.toFixed(6), { shouldValidate: true });
        toast.success(`Location captured (accuracy about ${Math.round(pos.coords.accuracy)} m)`);
      },
      (err) => {
        setLocating(false);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Choose an area or enter coordinates manually."
            : err.code === err.TIMEOUT
              ? "Getting your location timed out. Try again or enter coordinates manually."
              : "Your location is unavailable. Choose an area or enter coordinates manually.";
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  const onSubmit = handleSubmit(async (v) => {
    try {
      const result = await create.mutateAsync({
        patientName: v.patientName.trim(),
        patientAge: Number(v.patientAge),
        patientCondition: v.patientCondition.trim(),
        severity: v.severity,
        resourceType: v.resourceType,
        latitude: Number(v.latitude),
        longitude: Number(v.longitude),
      });
      onResult(result);
      if (result.allocated) {
        toast.success(`Bed reserved at ${result.request.hospitalName}`);
      } else {
        toast.warning("No suitable bed free - patient added to the priority queue");
      }
      reset({ ...DEFAULTS, severity: v.severity, resourceType: v.resourceType });
    } catch (e) {
      const err = e as ApiError;
      Object.entries(err.fieldErrors ?? {}).forEach(([field, message]) => {
        if (field in DEFAULTS) setError(field as keyof EmergencyFormValues, { message });
      });
      toast.error(err.message);
    }
  });

  const aria = (name: keyof EmergencyFormValues) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="New emergency request">
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <Field label="Patient name" htmlFor="patientName" error={errors.patientName?.message}>
          <Input id="patientName" placeholder="e.g. Test Patient Ravi" autoComplete="off" {...register("patientName")} {...aria("patientName")} />
        </Field>
        <Field label="Age" htmlFor="patientAge" error={errors.patientAge?.message}>
          <Input id="patientAge" inputMode="numeric" placeholder="45" {...register("patientAge")} {...aria("patientAge")} />
        </Field>
      </div>
      <Field label="Medical condition" htmlFor="patientCondition" error={errors.patientCondition?.message}>
        <Input id="patientCondition" placeholder="e.g. Suspected cardiac arrest" {...register("patientCondition")} {...aria("patientCondition")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Severity" htmlFor="severity" error={errors.severity?.message}>
          <NativeSelect id="severity" {...register("severity")} {...aria("severity")}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Required resource" htmlFor="resourceType" error={errors.resourceType?.message}>
          <NativeSelect id="resourceType" {...register("resourceType")} {...aria("resourceType")}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_LONG_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-sm border bg-background/60 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient location</legend>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Patient area" htmlFor="area" className="min-w-[170px] flex-1">
            <NativeSelect id="area" {...areaField}>
              <option value="">Manual / GPS coordinates</option>
              {SAMPLE_AREAS.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
            Use my location
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitude" htmlFor="latitude" error={errors.latitude?.message}>
            <Input id="latitude" inputMode="decimal" placeholder="13.0418" {...register("latitude", { onChange: () => setValue("area", "") })} {...aria("latitude")} />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={errors.longitude?.message}>
            <Input id="longitude" inputMode="decimal" placeholder="80.2341" {...register("longitude", { onChange: () => setValue("area", "") })} {...aria("longitude")} />
          </Field>
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={create.isPending}>
        {create.isPending ? <Loader2 className="animate-spin" /> : <Search />}
        Find nearest bed
      </Button>
    </form>
  );
}
