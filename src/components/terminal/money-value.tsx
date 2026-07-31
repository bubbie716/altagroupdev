"use client";

import { cn } from "@/lib/utils";
import {
  formatTerminalMoney,
  formatTerminalPercent,
  formatTerminalPrice,
} from "@/lib/terminal/format";
import { useEffect, useRef, useState } from "react";

function useSoftNumberTransition(
  value: number | null,
  enabled: boolean,
  durationMs = 400,
) {
  const prevRef = useRef<number | null>(null);
  const [display, setDisplay] = useState(value);
  const [highlight, setHighlight] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled || value == null) {
      prevRef.current = value;
      setDisplay(value);
      return;
    }

    const prev = prevRef.current;
    prevRef.current = value;
    if (prev == null || prev === value) {
      setDisplay(value);
      return;
    }

    if (reduceMotion) {
      setDisplay(value);
      setHighlight(true);
      const t = window.setTimeout(() => setHighlight(false), durationMs);
      return () => window.clearTimeout(t);
    }

    const start = prev;
    const delta = value - start;
    const t0 = performance.now();
    let raf = 0;
    setHighlight(true);
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setDisplay(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setDisplay(value);
        window.setTimeout(() => setHighlight(false), 80);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, enabled, durationMs, reduceMotion]);

  return { display: enabled ? display : value, highlight: enabled && highlight };
}

export function MoneyValue({
  value,
  signed = false,
  size = "md",
  className,
  asPrice = false,
  animateOnChange = false,
}: {
  value: number | null;
  signed?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  asPrice?: boolean;
  /** Soft count when authoritative value changes (e.g. after funding refresh). */
  animateOnChange?: boolean;
}) {
  const { display, highlight } = useSoftNumberTransition(value, animateOnChange);
  const text =
    display == null
      ? "—"
      : asPrice
        ? formatTerminalPrice(display)
        : formatTerminalMoney(display, { signed });
  return (
    <span
      className={cn(
        "tabular-nums tracking-tight text-[var(--terminal-text)] transition-colors duration-300",
        size === "sm" && "text-[13px]",
        size === "md" && "text-[15px]",
        size === "lg" && "text-[28px] font-medium leading-none sm:text-[34px]",
        size === "xl" && "text-[36px] font-medium leading-none sm:text-[44px]",
        className,
      )}
      data-balance-highlight={highlight ? "true" : undefined}
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
  amount: number | null;
  percent: number | null;
  className?: string;
  compact?: boolean;
}) {
  if (amount == null || percent == null) {
    return (
      <span
        className={cn(
          "inline-flex items-baseline tabular-nums text-[var(--terminal-muted)]",
          compact ? "text-[12px]" : "text-[13px] sm:text-[14px]",
          className,
        )}
        aria-label="Day change unavailable"
      >
        —
      </span>
    );
  }

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
