"use client";

import { Link } from "@tanstack/react-router";
import type { TimelineEvent } from "@/lib/internal/ops-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { AccountActivityLink } from "@/components/internal/internal-audit-table";
import {
  ACTIVITY_FILTER_LABELS,
  activityCategoryLabel,
  filterTimelineEvents,
  CUSTOMER_ACTIVITY_FILTERS,
  type ActivityFilterScope,
} from "@/lib/internal/record-activity-filters";
import type { RecordActivityFilter } from "@/lib/internal/record-workspace-search";
import { cn } from "@/lib/utils";
import { RecordEmptyCopy } from "@/components/internal/workspace/record-workspace-layout";

export function RecordActivityTimeline({
  events,
  filter,
  onFilterChange,
  filters = CUSTOMER_ACTIVITY_FILTERS,
  filterLabels,
  limit = 80,
  scope = "default",
}: {
  events: TimelineEvent[];
  filter?: RecordActivityFilter;
  onFilterChange: (filter: RecordActivityFilter) => void;
  filters?: readonly RecordActivityFilter[];
  filterLabels?: Partial<Record<RecordActivityFilter, string>>;
  /** Cap rendered events to avoid dumping hundreds of rows. */
  limit?: number;
  scope?: ActivityFilterScope;
}) {
  const active = filter ?? "all";
  const matched = filterTimelineEvents(events, active, scope);
  const filtered = matched.slice(0, limit);
  const truncated = matched.length > limit;

  return (
    <div className="space-y-3" data-record-activity>
      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Activity filters">
        {filters.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
            className={cn(
              "rounded border px-2.5 py-1 text-[12px] transition-colors",
              active === id
                ? "border-gold/40 bg-gold/10 text-foreground"
                : "border-border/70 text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
            aria-pressed={active === id}
          >
            {filterLabels?.[id] ?? ACTIVITY_FILTER_LABELS[id] ?? id}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <RecordEmptyCopy>
          {events.length === 0 ? "No activity recorded yet." : "No events match this filter."}
        </RecordEmptyCopy>
      ) : (
        <>
          <ol className="space-y-2.5">
            {filtered.map((e) => (
              <li
                key={e.id}
                className="rounded border border-border/60 bg-surface-1/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">
                      {e.href ? (
                        <Link to={e.href} className="break-words hover:text-gold">
                          {e.title}
                        </Link>
                      ) : (
                        <span className="break-words">{e.title}</span>
                      )}
                    </div>
                    {e.detail ? (
                      <p className="mt-0.5 break-words text-[12px] text-muted-foreground">{e.detail}</p>
                    ) : null}
                    {e.accountId && e.accountLabel ? (
                      <div className="mt-1">
                        <AccountActivityLink accountId={e.accountId} label={e.accountLabel} />
                      </div>
                    ) : null}
                  </div>
                  <span className="sr-only">Technical event code: {e.kind}</span>
                  <span
                    className="shrink-0 rounded bg-surface-2/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    title={e.kind}
                  >
                    {activityCategoryLabel(e.kind)}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{formatActivityDateTime(e.createdAt)}</span>
                  {e.actorLabel ? <span>· {e.actorLabel}</span> : null}
                </div>
              </li>
            ))}
          </ol>
          {truncated ? (
            <p className="text-[11px] text-muted-foreground">
              Showing the {limit} most recent matching events.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
