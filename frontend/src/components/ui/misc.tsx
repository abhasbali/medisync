import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Status label: small square tag with a leading dot. Colour carries meaning, never decoration. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-px text-[11px] font-medium whitespace-nowrap before:size-1.5 before:shrink-0 before:rounded-full before:content-['']",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground before:bg-primary",
        secondary: "bg-secondary text-secondary-foreground before:bg-muted-foreground",
        outline: "border text-foreground before:hidden",
        critical: "bg-crit/10 text-[oklch(0.45_0.17_27)] before:bg-crit",
        serious: "bg-low/15 text-[oklch(0.45_0.1_65)] before:bg-low",
        stable: "bg-ok/10 text-[oklch(0.42_0.09_155)] before:bg-ok",
        info: "bg-accent text-accent-foreground before:bg-primary",
        muted: "bg-secondary text-muted-foreground before:bg-muted-foreground/60",
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
  return <div className={cn("animate-pulse rounded-sm bg-secondary", className)} {...props} />;
}

/** Thin horizontal meter; value is a percentage 0..100. */
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
      className={cn("relative h-1.5 w-full overflow-hidden rounded-[1px] bg-secondary", className)}
    >
      <div
        className={cn("h-full bg-primary transition-[width] duration-500 ease-out", indicatorClassName)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-[13px]", className)} {...props} />
    </div>
  );
}
export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...p} className={cn("[&_tr]:border-b [&_tr]:hover:bg-transparent", p.className)} />
);
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...p} className={cn("[&_tr:last-child]:border-0", p.className)} />
);
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...p} className={cn("border-b transition-colors hover:bg-background/70", p.className)} />
);
export const TH = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    {...p}
    className={cn(
      "h-8 px-3 text-left align-middle text-[11px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap",
      p.className,
    )}
  />
);
export const TD = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...p} className={cn("px-3 py-2 align-middle", p.className)} />
);
