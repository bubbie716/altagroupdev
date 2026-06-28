"use client";

import type { OpsReviewFlagRow } from "@/lib/internal/ops-review-flag.types";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function OpsReviewFlagsBanner({ flags }: { flags: OpsReviewFlagRow[] }) {
  if (flags.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-400/50 bg-amber-400/10 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">
        Active operational review flags ({flags.length})
      </div>
      <ul className="mt-2 space-y-2">
        {flags.map((flag) => (
          <li key={flag.id} className="flex flex-wrap items-start justify-between gap-2 text-[13px]">
            <div>
              <OpsStatusBadge status={flag.reasonLabel} tone="warning" dot={false} />
              <span className="ml-2 text-muted-foreground">
                {flag.targetType.replace(/_/g, " ")} · flagged by {flag.createdByUsername}
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatActivityDateTime(flag.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
