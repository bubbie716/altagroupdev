import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type QueueTone = "alert" | "warn" | "info" | "neutral";

export type OpsQueueCardProps = {
  label: string;
  count: number;
  to: string;
  search?: Record<string, unknown>;
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
  search,
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
      search={search}
      className={cn(
        "group relative flex items-center justify-between gap-3 rounded border border-border bg-surface-1/60 px-3 py-2.5 transition-colors hover:border-border-strong hover:bg-surface-2/40",
      )}
    >
      <span
        className="pointer-events-none absolute inset-y-1 left-0 w-px bg-gold/0 transition-colors group-hover:bg-gold/70"
        aria-hidden
      />
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden />
        <div className="min-w-0">
          <div className="truncate text-[12px] text-foreground">{label}</div>
          {helper ? (
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
              {helper}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("tabular text-[13px] font-semibold leading-none", t.count)}>
          {count.toLocaleString()}
        </span>
        <ChevronRight className="size-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-gold" aria-hidden />
      </div>
    </Link>
  );
}
