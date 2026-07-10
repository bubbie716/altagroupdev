"use client";

import type { PreApprovalReadiness } from "@/lib/bank/relationship-intelligence-types";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";

const STATUS_LABELS = {
  ELIGIBLE: "Eligible for review",
  NOT_ELIGIBLE: "Not eligible",
  NEEDS_REVIEW: "Needs review",
} as const;

export function PreApprovalReadinessPanel({
  readiness,
  onReview,
  reviewing = false,
}: {
  readiness: PreApprovalReadiness;
  onReview?: () => void;
  reviewing?: boolean;
}) {
  return (
    <section className="rounded-xl border border-dashed border-border bg-surface-2/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Future pre-approval readiness
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Internal only — no pre-approved loan offers are generated yet.
          </p>
        </div>
        <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]">
          {STATUS_LABELS[readiness.readinessStatus]}
        </span>
      </div>

      {readiness.reasons.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
          {readiness.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {readiness.blockers.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-destructive/90">
          {readiness.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-[12px] text-muted-foreground">
        Suggested products (placeholder): {readiness.suggestedProducts.join(" · ")}
      </p>

      {onReview ? (
        <button
          type="button"
          disabled={reviewing}
          onClick={onReview}
          className="mt-4 rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-60"
        >
          {reviewing ? SUBMITTING_COPY.logging : "Log readiness review"}
        </button>
      ) : null}
    </section>
  );
}
