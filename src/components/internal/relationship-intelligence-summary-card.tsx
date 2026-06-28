import { Link } from "@tanstack/react-router";
import { florin } from "@/lib/bank/api";
import {
  RELATIONSHIP_TIER_LABELS,
} from "@/lib/bank/relationship-intelligence-config";
import type { RelationshipProfileSummary } from "@/lib/bank/relationship-intelligence-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function RelationshipIntelligenceSummaryCard({
  summary,
  userId,
  compact = false,
}: {
  summary: RelationshipProfileSummary | null;
  userId: string;
  compact?: boolean;
}) {
  if (!summary) {
    return (
      <section className="rounded-xl border border-border bg-surface-1/80 p-5">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Relationship intelligence
        </h3>
        <p className="mt-2 text-[13px] text-muted-foreground">
          No persisted profile yet. Refresh from the{" "}
          <Link to="/internal/relationships/$userId" params={{ userId }} className="text-gold hover:underline">
            relationship profile
          </Link>{" "}
          page.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Relationship intelligence
          </h3>
          {!compact ? (
            <p className="mt-1 text-[12px] text-muted-foreground">Read-only profile summary</p>
          ) : null}
        </div>
        <Link
          to="/internal/relationships/$userId"
          params={{ userId }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          View profile →
        </Link>
      </div>

      <dl className={`mt-4 grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"} text-[14px]`}>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Score</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{summary.relationshipScore}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tier</dt>
          <dd className="mt-1 font-medium">{RELATIONSHIP_TIER_LABELS[summary.relationshipTier]}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Total Alta assets</dt>
          <dd className="mt-1 tabular-nums">{florin(summary.totalAltaAssets)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Private eligible</dt>
          <dd className="mt-1">{summary.privateBankingEligible ? "Yes" : "No"}</dd>
        </div>
      </dl>

      {!compact ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Last calculated {formatActivityDateTime(summary.lastCalculatedAt)}
        </p>
      ) : null}
    </section>
  );
}
