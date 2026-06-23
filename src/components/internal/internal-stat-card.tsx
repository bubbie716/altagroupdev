import { Card } from "@/components/page-shell";
import { cn } from "@/lib/utils";

export function InternalStatCard({
  label,
  value,
  sub,
  alert,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("!p-4", className)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("tabular mt-2 text-xl font-semibold tracking-tight", alert && "text-[var(--destructive)]")}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}
