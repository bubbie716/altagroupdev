import type { AltaCardRelationshipRecommendation } from "@/lib/bank/alta-card-types";
import { mapRelationshipRecommendationToDisplayRows } from "@/lib/bank/alta-card-relationship-display";

export function AltaCardRelationshipRecommendationPanel({
  recommendation,
  className,
}: {
  recommendation: AltaCardRelationshipRecommendation | null;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 max-w-full rounded-xl border border-gold/30 bg-gold/5 p-6 ${className ?? ""}`}
    >
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Relationship recommendations
      </h3>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Based on your Alta relationship — recommendation only, not a guarantee of approval.
      </p>

      {recommendation ? (
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {mapRelationshipRecommendationToDisplayRows(recommendation).map((row) => (
            <div key={row.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {row.label}
              </dt>
              <dd className="mt-1 text-[15px] font-medium tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-border/70 bg-surface-1/40 px-4 py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Relationship Intelligence unavailable
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Personalized tier, limit, and rate recommendations will appear here when your
            Relationship Intelligence profile is available.
          </p>
        </div>
      )}
    </section>
  );
}
