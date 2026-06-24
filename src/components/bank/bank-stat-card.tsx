import { Card } from "@/components/page-shell";
import { cn } from "@/lib/utils";

export function BankStatCard({
  label,
  value,
  sub,
  accent,
  signedValue,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** When set, value text is green if positive and red if negative. */
  signedValue?: number;
  className?: string;
}) {
  const signedTone =
    signedValue !== undefined
      ? signedValue > 0
        ? "text-[var(--success)]"
        : signedValue < 0
          ? "text-[var(--destructive)]"
          : undefined
      : undefined;

  return (
    <Card className={cn("!p-5", className)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "tabular mt-2 text-xl font-semibold tracking-tight",
          accent && "text-[var(--success)]",
          signedTone,
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}
