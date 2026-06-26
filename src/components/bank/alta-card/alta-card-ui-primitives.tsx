import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AltaCardProductEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{children}</p>
  );
}

export function AltaCardSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface-1/80 p-5 sm:p-6", className)}>
      <h3 className="font-serif text-[18px] tracking-tight sm:text-[20px]">{title}</h3>
      {description ? <p className="mt-1 text-[13px] text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AltaCardMetric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-1/80 p-4",
        emphasis && "border-gold/25 bg-gold/5",
      )}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 font-mono tabular-nums text-foreground",
          emphasis ? "text-[18px] sm:text-[20px]" : "text-[15px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function AltaCardUtilizationBar({
  utilization,
  label = "Credit utilization",
}: {
  utilization: number;
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, utilization));
  const tone =
    pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-gold";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[13px] tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AltaCardActionButton({
  label,
  onClick,
  variant = "default",
  disabled,
  className,
}: {
  label: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors disabled:opacity-50",
        variant === "primary" && "border-foreground bg-foreground text-background",
        variant === "default" && "border-border bg-surface-2 text-foreground hover:bg-surface-1",
        variant === "ghost" && "border-transparent bg-transparent text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label}
    </button>
  );
}
