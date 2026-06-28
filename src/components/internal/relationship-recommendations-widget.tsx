import { Link } from "@tanstack/react-router";
import type { RelationshipRecommendationRow } from "@/lib/bank/relationship-intelligence-types";
import {
  formatRecommendedAction,
  recommendationTypeLabel,
} from "@/lib/bank/relationship-recommendation-display";

export function RelationshipRecommendationsWidget({
  userId,
  recommendations,
  limit = 3,
}: {
  userId: string;
  recommendations: RelationshipRecommendationRow[];
  limit?: number;
}) {
  const active = recommendations.filter((r) => r.status === "ACTIVE").slice(0, limit);

  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Relationship recommendations
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">Read-only — admin review required</p>
        </div>
        <Link
          to="/internal/relationships/$userId"
          params={{ userId }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          View all →
        </Link>
      </div>

      {active.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">No active recommendations.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {active.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-border/60 px-3 py-2.5 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  {recommendationTypeLabel(rec.recommendationType)}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {rec.confidenceScore}% conf.
                </span>
              </div>
              <p className="mt-1 font-medium">{rec.title}</p>
              <p className="mt-0.5 text-muted-foreground">{formatRecommendedAction(rec)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
