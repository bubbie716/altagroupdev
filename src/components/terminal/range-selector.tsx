"use client";

import { cn } from "@/lib/utils";
import type { TerminalChartRange } from "@/lib/terminal/types";

const RANGES: TerminalChartRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

export function RangeSelector({
  value,
  onChange,
  className,
}: {
  value: TerminalChartRange;
  onChange: (range: TerminalChartRange) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("inline-flex flex-wrap gap-0.5", className)}
      role="group"
      aria-label="Chart range"
    >
      {RANGES.map((range) => {
        const active = range === value;
        return (
          <button
            key={range}
            type="button"
            onClick={() => onChange(range)}
            aria-pressed={active}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2.5 text-[11px] font-medium tracking-wide transition-colors max-[359px]:min-h-9 max-[359px]:min-w-9 max-[359px]:px-1.5 max-[359px]:text-[10px]",
              active
                ? "bg-[var(--terminal-green)]/15 text-[var(--terminal-green)]"
                : "text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]",
            )}
          >
            {range}
          </button>
        );
      })}
    </div>
  );
}
