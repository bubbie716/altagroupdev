"use client";

import { cn } from "@/lib/utils";
import {
  formatTerminalMoney,
  formatTerminalPercent,
  formatTerminalPrice,
} from "@/lib/terminal/format";

export function MoneyValue({
  value,
  signed = false,
  size = "md",
  className,
  asPrice = false,
}: {
  value: number;
  signed?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  asPrice?: boolean;
}) {
  const text = asPrice ? formatTerminalPrice(value) : formatTerminalMoney(value, { signed });
  return (
    <span
      className={cn(
        "tabular-nums tracking-tight text-[var(--terminal-text)]",
        size === "sm" && "text-[13px]",
        size === "md" && "text-[15px]",
        size === "lg" && "text-[28px] font-medium leading-none sm:text-[34px]",
        size === "xl" && "text-[36px] font-medium leading-none sm:text-[44px]",
        className,
      )}
    >
      {text}
    </span>
  );
}

export function PriceChange({
  amount,
  percent,
  className,
  compact = false,
}: {
  amount: number;
  percent: number;
  className?: string;
  compact?: boolean;
}) {
  const positive = amount > 0 || (amount === 0 && percent > 0);
  const negative = amount < 0 || percent < 0;
  const tone = positive ? "ticker-up" : negative ? "ticker-down" : "text-[var(--terminal-muted)]";
  const signWord = positive ? "up" : negative ? "down" : "unchanged";

  return (
    <span
      className={cn("inline-flex items-baseline gap-1.5 tabular-nums", tone, className)}
      aria-label={`Day change ${signWord} ${formatTerminalMoney(amount, { signed: true })} (${formatTerminalPercent(percent)})`}
    >
      <span className={cn(compact ? "text-[12px]" : "text-[13px] sm:text-[14px]")}>
        {formatTerminalMoney(amount, { signed: true })}
      </span>
      <span className={cn(compact ? "text-[12px]" : "text-[13px] sm:text-[14px]")}>
        ({formatTerminalPercent(percent)})
      </span>
    </span>
  );
}
