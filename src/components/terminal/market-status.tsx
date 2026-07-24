"use client";

import { cn } from "@/lib/utils";
import type { MarketSessionStatus, SecurityTradingStatus } from "@/lib/terminal/types";
import { tradingStatusLabel } from "@/lib/terminal/order-validation";

export function MarketStatusBadge({
  status,
  label,
  className,
}: {
  status: MarketSessionStatus;
  label: string;
  className?: string;
}) {
  const open = status === "open";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-[var(--terminal-border)] px-2 py-1 text-[11px] text-[var(--terminal-muted)]",
        className,
      )}
      role="status"
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          open ? "bg-[var(--terminal-green)]" : "bg-[var(--terminal-muted)]",
        )}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function SecurityStatusBadge({ status }: { status: SecurityTradingStatus }) {
  const halted = status === "halted";
  const delayed = status === "delayed";
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
        halted
          ? "border-[var(--terminal-red)]/40 text-[var(--terminal-red)]"
          : delayed
            ? "border-[var(--terminal-border)] text-[var(--terminal-muted)]"
            : "border-[var(--terminal-border)] text-[var(--terminal-muted)]",
      )}
    >
      {tradingStatusLabel(status)}
    </span>
  );
}
