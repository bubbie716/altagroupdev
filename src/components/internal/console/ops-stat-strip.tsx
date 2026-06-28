import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OpsStat = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "gold" | "warn" | "alert" | "ok";
};

const toneClass: Record<NonNullable<OpsStat["tone"]>, string> = {
  neutral: "text-foreground",
  gold: "text-gold",
  warn: "text-amber-300",
  alert: "text-rose-300",
  ok: "text-emerald-300",
};

/** Hairline-divided stat row for internal page headers. */
const LG_COLS: Record<number, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

export function OpsStatStrip({
  stats,
  className,
}: {
  stats: OpsStat[];
  className?: string;
}) {
  const cols = LG_COLS[Math.min(Math.max(stats.length, 2), 6)] ?? "lg:grid-cols-4";
  return (
    <div
      className={cn(
        "mb-4 grid grid-cols-2 divide-x divide-border rounded border border-border bg-surface-1/40 sm:grid-cols-3",
        cols,
        className,
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {s.label}
          </div>
          <div
            className={cn(
              "tabular mt-1 text-[15px] font-semibold leading-tight",
              toneClass[s.tone ?? "neutral"],
            )}
          >
            {s.value}
          </div>
          {s.hint ? (
            <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {s.hint}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}