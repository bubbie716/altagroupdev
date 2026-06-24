import { Card } from "@/components/page-shell";
import { MetricValue } from "@/components/metrics/metric-value";
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
    <Card className={cn("flex h-full min-w-0 flex-col justify-between", className)}>
      <div className={cn(type.meta)}>{label}</div>
      <MetricValue className="mt-3">{value}</MetricValue>
      {helper ? (
        <p className={cn(type.bodySm, "mt-2 text-muted-foreground")}>{helper}</p>
      ) : null}
      {sourceLabel ? (
        <div className={cn(type.metaAccent, "mt-4 opacity-90")}>{sourceLabel}</div>
      ) : null}
    </Card>
  );
}
