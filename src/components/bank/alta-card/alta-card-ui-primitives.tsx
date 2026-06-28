import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type AltaCardQuickActionVariant = "default" | "primary" | "ghost";

/** Shared tile styling for Alta Card dashboard quick actions. */
export function altaCardQuickActionClass(
  variant: AltaCardQuickActionVariant = "default",
  opts?: { disabled?: boolean },
): string {
  const disabled = opts?.disabled ?? false;

  return cn(
    "inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-3 py-2.5",
    "text-center font-mono text-[10px] leading-snug uppercase tracking-[0.14em] transition-colors sm:text-[11px] sm:tracking-[0.16em]",
    variant === "primary" &&
      !disabled &&
      "border-foreground bg-foreground text-background shadow-sm hover:bg-foreground/90",
    variant === "default" &&
      !disabled &&
      "border-border bg-surface-2 text-foreground hover:border-foreground/20 hover:bg-surface-1",
    variant === "ghost" &&
      !disabled &&
      "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground",
    disabled &&
      "cursor-not-allowed border-border/60 bg-surface-2/50 text-muted-foreground opacity-60",
  );
}

export function AltaCardQuickActionLink({
  label,
  variant = "default",
  disabled,
  className,
  ...linkProps
}: {
  label: string;
  variant?: AltaCardQuickActionVariant;
  disabled?: boolean;
  className?: string;
} & LinkProps) {
  if (disabled) {
    return (
      <span
        className={cn(altaCardQuickActionClass(variant, { disabled: true }), className)}
        aria-disabled
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      {...linkProps}
      className={cn(altaCardQuickActionClass(variant), className)}
    >
      {label}
    </Link>
  );
}

export function AltaCardQuickActionCell({ children }: { children: ReactNode }) {
  return <div className="min-w-0">{children}</div>;
}

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
    <section className={cn("min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-surface-1/80 p-5 sm:p-6", className)}>
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
        "min-w-0 rounded-lg border border-border bg-surface-1/80 p-4",
        emphasis && "border-gold/25 bg-gold/5",
      )}
    >
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 break-words font-mono tabular-nums text-foreground",
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
  tile = false,
}: {
  label: string;
  onClick?: () => void;
  variant?: AltaCardQuickActionVariant;
  disabled?: boolean;
  className?: string;
  /** Use dashboard quick-action tile sizing (full width, min height). */
  tile?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        tile
          ? altaCardQuickActionClass(variant, { disabled })
          : cn(
              "rounded-lg border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
              variant === "primary" &&
                !disabled &&
                "border-foreground bg-foreground text-background hover:bg-foreground/90",
              variant === "default" &&
                !disabled &&
                "border-border bg-surface-2 text-foreground hover:bg-surface-1",
              variant === "ghost" &&
                !disabled &&
                "border-transparent bg-transparent text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-50",
            ),
        className,
      )}
    >
      {label}
    </button>
  );
}
