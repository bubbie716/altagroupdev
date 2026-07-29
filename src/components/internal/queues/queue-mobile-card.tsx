"use client";

import type { ReactNode } from "react";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { QueueAgeCell } from "@/components/internal/queues/queue-age-cell";

/** Stacked queue row for narrow viewports — keeps actions reachable without horizontal scroll. */
export function QueueMobileCard({
  title,
  subtitle,
  amount,
  status,
  ageIso,
  onOpen,
  actions,
}: {
  title: string;
  subtitle?: string;
  amount?: string;
  status?: string;
  ageIso?: string;
  onOpen?: () => void;
  actions?: ReactNode;
}) {
  return (
    <article className="rounded border border-border/80 bg-surface-1/40 px-3 py-2.5">
      <button
        type="button"
        className="w-full text-left"
        onClick={onOpen}
        disabled={!onOpen}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-foreground">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {amount ? <p className="type-finance tabular-nums text-[12px]">{amount}</p> : null}
            {ageIso ? (
              <div className="mt-0.5">
                <QueueAgeCell isoOrDate={ageIso} />
              </div>
            ) : null}
          </div>
        </div>
        {status ? (
          <div className="mt-2">
            <OpsStatusBadge status={status} />
          </div>
        ) : null}
      </button>
      {actions ? (
        <div className="mt-2 flex flex-wrap gap-1 border-t border-border/50 pt-2" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </article>
  );
}
