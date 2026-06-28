import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared filter panel chrome for internal explore and audit pages. */
export function OpsFilterBar({
  children,
  onClear,
  clearLabel = "Clear filters",
  className,
}: {
  children: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 grid gap-x-4 gap-y-2 border-y border-border/60 bg-surface-1/30 px-3 py-2.5 md:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
      {onClear ? (
        <div className="flex items-end md:col-span-2 lg:col-span-1">
          <button
            type="button"
            onClick={onClear}
            className="h-8 w-full rounded-sm border border-border/70 px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-gold/40 hover:bg-surface-2 hover:text-foreground"
          >
            {clearLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const OPS_FILTER_FIELD_CLASS =
  "h-8 w-full rounded-sm border border-border/70 bg-surface-1 px-2.5 text-[12px] outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold/30";

export const OPS_FILTER_LABEL_CLASS =
  "mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground";

export function OpsFilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className={OPS_FILTER_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}
