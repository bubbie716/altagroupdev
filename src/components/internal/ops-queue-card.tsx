import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
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

const toneStyles: Record<QueueTone, { dot: string; count: string }> = {
  alert:   { dot: "bg-rose-500",       count: "text-foreground" },
  warn:    { dot: "bg-amber-500",      count: "text-foreground" },
  info:    { dot: "bg-sky-500",        count: "text-foreground" },
  neutral: { dot: "bg-muted-foreground/50", count: "text-muted-foreground" },
};

export function OpsQueueCard({
  label,
  count,
  to,
  helper,
  cta = "Open queue",
  tone,
}: OpsQueueCardProps) {
  const resolvedTone: QueueTone = tone ?? (count > 0 ? "warn" : "neutral");
  const t = toneStyles[resolvedTone];
  void cta;
  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center justify-between gap-3 rounded border border-border bg-surface-1/60 px-3 py-2 transition-colors hover:border-border-strong hover:bg-surface-2/40",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />
        <span className="truncate text-[12px] text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("tabular text-[13px] font-semibold leading-none", t.count)}>
          {count.toLocaleString()}
        </span>
        <ChevronRight className="size-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </div>
      {helper ? <span className="sr-only">{helper}</span> : null}
    </Link>
  );
}
