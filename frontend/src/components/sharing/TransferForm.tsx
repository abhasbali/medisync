import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { useCreateTransfer } from "@/hooks/queries";
import { RESOURCE_LONG_LABELS } from "@/lib/format";
import { RESOURCE_TYPES, type Hospital } from "@/types/api";
import type { ApiError } from "@/services/api";

export const transferSchema = z
  .object({
    requesterHospitalId: z.string().min(1, "Select the requesting hospital"),
    donorHospitalId: z.string().min(1, "Select the donor hospital"),
    resourceType: z.enum(RESOURCE_TYPES, { errorMap: () => ({ message: "Select a resource" }) }),
    quantity: z
      .string()
      .trim()
      .min(1, "Quantity is required")
      .refine((v) => /^-?\d+$/.test(v), "Quantity must be a whole number")
      .refine((v) => Number(v) >= 1, "Quantity must be at least 1")
      .refine((v) => Number(v) <= 1000, "Quantity must be at most 1000"),
    note: z.string().max(500, "At most 500 characters"),
  })
  .refine((v) => !v.requesterHospitalId || v.requesterHospitalId !== v.donorHospitalId, {
    path: ["donorHospitalId"],
    message: "Requesting and donor hospital must be different",
  });

export type TransferFormValues = z.infer<typeof transferSchema>;

const DEFAULTS: TransferFormValues = {
  requesterHospitalId: "",
  donorHospitalId: "",
  resourceType: "ICU",
  quantity: "1",
  note: "",
};

export function TransferForm({ hospitals }: { hospitals: Hospital[] }) {
  const create = useCreateTransfer();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransferFormValues>({ resolver: zodResolver(transferSchema), defaultValues: DEFAULTS });

  const donorId = watch("donorHospitalId");
  const type = watch("resourceType");
  const qty = Number(watch("quantity"));
  const donorRow = hospitals.find((h) => String(h.id) === donorId)?.inventory.find((i) => i.resourceType === type);
  const short = donorRow != null && Number.isFinite(qty) && qty > donorRow.available;

  const onSubmit = handleSubmit(async (v) => {
    try {
      const t = await create.mutateAsync({
        requesterHospitalId: Number(v.requesterHospitalId),
        donorHospitalId: Number(v.donorHospitalId),
        resourceType: v.resourceType,
        quantity: Number(v.quantity),
        note: v.note.trim() || undefined,
      });
      toast.success(`Request #${t.id} sent to ${t.donorHospitalName}`);
      reset(DEFAULTS);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  });

  const aria = (name: keyof TransferFormValues) => ({
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="New resource request">
      <Field label="Requesting hospital" htmlFor="requesterHospitalId" error={errors.requesterHospitalId?.message}>
        <NativeSelect id="requesterHospitalId" {...register("requesterHospitalId")} {...aria("requesterHospitalId")}>
          <option value="">Select hospital</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Donor hospital" htmlFor="donorHospitalId" error={errors.donorHospitalId?.message}>
        <NativeSelect id="donorHospitalId" {...register("donorHospitalId")} {...aria("donorHospitalId")}>
          <option value="">Select hospital</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Resource" htmlFor="resourceType" error={errors.resourceType?.message}>
          <NativeSelect id="resourceType" {...register("resourceType")} {...aria("resourceType")}>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_LONG_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message}>
          <Input id="quantity" inputMode="numeric" {...register("quantity")} {...aria("quantity")} />
        </Field>
      </div>
      {donorRow && (
        <p className={short ? "text-xs font-medium text-amber-700" : "text-xs text-muted-foreground"}>
          Donor currently has {donorRow.available} free of {donorRow.total}.
          {short && " Approval will fail unless more units become free."}
        </p>
      )}
      <Field label="Note (optional)" htmlFor="note" error={errors.note?.message}>
        <Textarea id="note" placeholder="Reason, e.g. surge in respiratory cases" {...register("note")} />
      </Field>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        Send request
      </Button>
    </form>
  );
}
