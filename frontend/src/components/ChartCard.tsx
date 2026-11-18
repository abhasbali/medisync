import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  loading,
  empty,
  legend,
  height = 240,
  className,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  empty?: boolean;
  legend?: { label: string; color: string }[];
  height?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {legend && (
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <span className="size-2" style={{ background: l.color }} /> {l.label}
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <div className="p-4" style={{ height }}>
        {loading ? (
          <Skeleton className="h-full" />
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No data yet</div>
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

export function KpiRow({ items }: { items: { label: string; value: string; sub?: string; alert?: boolean }[] }) {
  return (
    <Card className="grid grid-cols-2 divide-x lg:grid-cols-4">
      {items.map((k, i) => (
        <div key={k.label} className={cn("px-4 py-3.5", i >= 2 && "border-t lg:border-t-0", i === 2 && "border-l-0 lg:border-l")}>
          <p className="eyebrow">{k.label}</p>
          <p className={cn("num mt-1 text-[24px] font-medium leading-8", k.alert ? "text-crit" : "text-foreground")}>{k.value}</p>
          {k.sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{k.sub}</p>}
        </div>
      ))}
    </Card>
  );
}
