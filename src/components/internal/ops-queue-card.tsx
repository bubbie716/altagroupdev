import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type QueueTone = "alert" | "warn" | "info" | "neutral";

export type OpsQueueCardProps = {
  label: string;
  count: number;
  to: string;
  helper?: string;
  cta?: string;
  tone?: QueueTone;
};

const toneStyles: Record<QueueTone, { ring: string; dot: string; count: string }> = {
  alert: {
    ring: "border-rose-500/40 bg-rose-500/[0.04] hover:border-rose-500/70",
    dot: "bg-rose-500",
    count: "text-rose-300",
  },
  warn: {
    ring: "border-amber-500/40 bg-amber-500/[0.04] hover:border-amber-500/70",
    dot: "bg-amber-500",
    count: "text-amber-200",
  },
  info: {
    ring: "border-sky-500/40 bg-sky-500/[0.04] hover:border-sky-500/70",
    dot: "bg-sky-400",
    count: "text-sky-200",
  },
  neutral: {
    ring: "border-border bg-surface-1/80 hover:border-border-strong",
    dot: "bg-muted-foreground/60",
    count: "text-foreground",
  },
};

export function OpsQueueCard({
  label,
  count,
  to,
  helper,
  cta = "Open queue",
  tone,
}: OpsQueueCardProps) {
  const resolvedTone: QueueTone = tone ?? (count > 0 ? "alert" : "neutral");
  const t = toneStyles[resolvedTone];
  return (
    <Link
      to={to}
      className={cn(
        "group flex h-full flex-col justify-between rounded-xl border p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevated",
        t.ring,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full", t.dot)} aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </span>
          </div>
          <div className={cn("tabular mt-3 text-4xl font-semibold leading-none", t.count)}>
            {count.toLocaleString()}
          </div>
          {helper ? (
            <p className="mt-2 text-[12px] text-muted-foreground">{helper}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-gold">
        <span>{cta}</span>
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
    </Link>
  );
}
