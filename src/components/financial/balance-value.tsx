"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { florin } from "@/lib/bank/api";

/**
 * Soft highlight when an authoritative balance changes after refresh.
 * Does not animate from zero; only transitions when the value actually changes.
 * Respects prefers-reduced-motion.
 */
export function BalanceValue({
  value,
  className,
  format = florin,
  durationMs = 400,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
  durationMs?: number;
}) {
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
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        window.setTimeout(() => setHighlight(false), 80);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs, reduceMotion]);

  return (
    <span
      className={cn(
        "tabular-nums transition-colors duration-300",
        highlight && "text-foreground",
        className,
      )}
      data-balance-highlight={highlight ? "true" : undefined}
    >
      {format(display)}
    </span>
  );
}
