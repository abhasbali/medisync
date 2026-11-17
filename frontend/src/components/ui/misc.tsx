import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-teal-800",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        critical: "border-red-200 bg-red-50 text-red-700",
        serious: "border-amber-200 bg-amber-50 text-amber-800",
        stable: "border-emerald-200 bg-emerald-50 text-emerald-700",
        info: "border-blue-200 bg-blue-50 text-blue-700",
        muted: "border-slate-200 bg-slate-100 text-slate-600",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} {...props} />;
}

/** Horizontal progress bar; value is a percentage 0..100. */
export function Progress({
  value,
  className,
  indicatorClassName,
  label,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500 ease-out", indicatorClassName)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...p} className={cn("[&_tr]:border-b bg-slate-50/80", p.className)} />
);
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...p} className={cn("[&_tr:last-child]:border-0", p.className)} />
);
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...p} className={cn("border-b transition-colors hover:bg-slate-50/60", p.className)} />
);
export const TH = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    {...p}
    className={cn(
      "h-10 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
      p.className,
    )}
  />
);
export const TD = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...p} className={cn("px-3 py-2.5 align-middle", p.className)} />
);
