"use client";

import { useId, useMemo } from "react";
import type { PricePoint } from "@/lib/terminal/types";
import { cn } from "@/lib/utils";

/** Lightweight SVG sparkline for tables — no Recharts overhead. */
export function Sparkline({
  data,
  positive = true,
  width = 72,
  height = 28,
  className,
  label = "Price trend",
}: {
  data: PricePoint[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
  label?: string;
}) {
  const id = useId();
  const path = useMemo(() => {
    if (!data.length) return "";
    const values = data.map((d) => d.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return data
      .map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * width;
        const y = height - ((d.v - min) / span) * (height - 2) - 1;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data, height, width]);

  if (!data.length) {
    return <span className="inline-block text-[11px] text-[var(--terminal-muted)]">—</span>;
  }

  const stroke = positive ? "var(--terminal-green)" : "var(--terminal-red)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path id={id} d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
