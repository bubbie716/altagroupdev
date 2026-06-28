import type { ReactNode } from "react";
import { formatDueDate } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";

export const RELATIONSHIP_METRIC_LABEL =
  "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground";
export const RELATIONSHIP_METRIC_VALUE = "mt-1.5 text-[15px] tabular-nums";
export const RELATIONSHIP_SECTION_GAP = "mt-8";
export const RELATIONSHIP_STAT_GRID =
  "flex min-w-0 flex-col divide-y divide-border/60 sm:grid sm:grid-cols-2 sm:divide-y-0 sm:gap-4 lg:grid-cols-4";
export const RELATIONSHIP_STAT_CELL = "py-4 first:pt-0 last:pb-0 sm:py-0";

export function RelationshipProgressBar({
  currentTierLabel,
  nextTierLabel,
  progressPercent,
}: {
  currentTierLabel: string;
  nextTierLabel: string | null;
  progressPercent: number;
}) {
  return (
    <div className="mt-6 min-w-0 border-t border-border/60 pt-5">
      <p className={RELATIONSHIP_METRIC_LABEL}>Relationship progress</p>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2/80"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          nextTierLabel
            ? `Progress toward ${nextTierLabel} tier`
            : `${currentTierLabel} — highest relationship tier`
        }
      >
        <div className="h-full rounded-full bg-gold/70" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
        <span>
          <span className="text-muted-foreground">Current: </span>
          <span className="font-medium">{currentTierLabel}</span>
        </span>
        {nextTierLabel ? (
          <span>
            <span className="text-muted-foreground">Next: </span>
            <span className="font-medium">{nextTierLabel}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Highest tier reached</span>
        )}
      </div>
    </div>
  );
}

export function ProductTags({ labels }: { labels: string[] }) {
  if (labels.length === 0) {
    return <span className="text-[15px] text-muted-foreground">—</span>;
  }
  return (
    <ul className="flex min-w-0 flex-wrap gap-1.5">
      {labels.map((label) => (
        <li
          key={label}
          className="rounded-full border border-border/80 bg-surface-2/30 px-2.5 py-0.5 text-[12px] leading-relaxed text-foreground"
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

export function RelationshipTimelineList({
  events,
  emptyMessage,
}: {
  events: Array<{
    id: string;
    title: string;
    description?: string | null;
    occurredAt: string;
  }>;
  emptyMessage: string;
}) {
  if (events.length === 0) {
    return <p className="text-[14px] text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="min-w-0 max-h-[min(28rem,50vh)] overflow-y-auto overscroll-contain pr-1">
      <ol className="ml-3 min-w-0 border-l border-border/60">
        {events.map((event) => (
          <li key={event.id} className="relative min-w-0 pb-6 pl-5 last:pb-0">
            <span
              aria-hidden
              className="absolute -left-px top-1.5 z-[1] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-gold/50 bg-surface-1"
            />
            <p className="break-words text-[15px] font-medium leading-snug">{event.title}</p>
            {event.description ? (
              <p className="mt-1 break-words text-[13px] leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            ) : null}
            <time
              dateTime={event.occurredAt}
              className="mt-1.5 block text-[11px] text-muted-foreground/80"
            >
              {formatDueDate(event.occurredAt)}
            </time>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function RelationshipTierPill({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-border bg-surface-2/40 px-3.5 py-1.5 font-serif text-[18px] font-medium tracking-tight text-foreground">
      {label}
    </span>
  );
}

export function RelationshipAssetValue({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-serif text-[26px] font-medium leading-tight tabular-nums tracking-tight sm:text-[28px]",
        className,
      )}
    >
      {children}
    </span>
  );
}
