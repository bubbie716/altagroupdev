import { Card } from "@/components/page-shell";
import { type } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function LiveMetricCard({
  label,
  value,
  helper,
  sourceLabel,
  className,
}: {
  label: string;
  value: string;
  helper?: string;
  sourceLabel?: string;
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col justify-between", className)}>
      <div className={type.meta}>{label}</div>
      <div className={cn(type.financeHero, "mt-3")}>{value}</div>
      {helper ? (
        <p className={cn(type.bodySm, "mt-2 text-muted-foreground")}>{helper}</p>
      ) : null}
      {sourceLabel ? (
        <div className={cn(type.metaAccent, "mt-4 opacity-90")}>{sourceLabel}</div>
      ) : null}
    </Card>
  );
}
