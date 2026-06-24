import { Card } from "@/components/page-shell";
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
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold tracking-tight tabular">
        {value}
      </div>
      {helper ? (
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{helper}</p>
      ) : null}
      {sourceLabel ? (
        <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-gold/90">
          {sourceLabel}
        </div>
      ) : null}
    </Card>
  );
}
