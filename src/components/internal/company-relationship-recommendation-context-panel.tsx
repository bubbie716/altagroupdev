"use client";

import { useState } from "react";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import { COMPANY_RECOMMENDATION_TYPE_LABELS } from "@/lib/bank/company-relationship-recommendation-config";
import type {
  CompanyRelationshipRecommendationRow,
} from "@/lib/bank/company-relationship-intelligence-types";
import type {
  RecommendationPrefill,
  RelationshipIntegrationContext,
} from "@/lib/bank/relationship-intelligence-types";
import { CONTEXT_LABELS } from "@/lib/bank/relationship-integration-config";
import { useCompanyRelationshipRecommendationRecord } from "@/lib/internal/company-relationship-intelligence.functions";

function formatAction(rec: CompanyRelationshipRecommendationRow): string {
  const parts: string[] = [];
  if (rec.recommendedLimit != null) parts.push(`Limit ${formatAltaCardCurrency(rec.recommendedLimit)}`);
  if (rec.recommendedRate != null) parts.push(`Rate ${rec.recommendedRate}%`);
  if (rec.recommendedTier) parts.push(`Tier ${rec.recommendedTier}`);
  return parts.join(" · ") || rec.summary;
}

export function CompanyRelationshipRecommendationContextPanel({
  context,
  recommendations,
  onUseRecommendation,
}: {
  context: RelationshipIntegrationContext;
  recommendations: CompanyRelationshipRecommendationRow[];
  onUseRecommendation?: (prefill: RecommendationPrefill) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const useRecommendation = useCompanyRelationshipRecommendationRecord();

  const active = recommendations.filter((r) => r.status === "ACTIVE");

  async function handleUse(recommendationId: string) {
    setBusyId(recommendationId);
    setError(null);
    try {
      const prefill = await useRecommendation({
        data: { recommendationId, context },
      });
      onUseRecommendation?.(prefill);
    } catch {
      setError("Could not apply company recommendation prefill.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-gold/25 bg-gold/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Company recommended review
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {CONTEXT_LABELS[context]} — business relationship prefill only. Admin confirmation required.
          </p>
        </div>
      </div>

      {error ? <p className="mt-3 text-[13px] text-destructive">{error}</p> : null}

      {active.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">No active company recommendations for this context.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {active.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                    {COMPANY_RECOMMENDATION_TYPE_LABELS[rec.recommendationType]}
                  </p>
                  <p className="mt-1 text-[14px] font-medium">{rec.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{formatAction(rec)}</p>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{rec.confidenceScore}% conf.</span>
              </div>
              {rec.reasons.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                  {rec.reasons.bullets.slice(0, 4).map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {onUseRecommendation ? (
                <button
                  type="button"
                  disabled={busyId === rec.id}
                  onClick={() => void handleUse(rec.id)}
                  className="mt-3 rounded border border-gold/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:bg-gold/10 disabled:opacity-60"
                >
                  {busyId === rec.id ? "Applying…" : "Use recommendation"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function companyRecommendationPrefillToAltaCardDefaults(prefill: RecommendationPrefill): {
  tier?: AltaCardTierCode;
  limit?: string;
  rate?: string;
} {
  return {
    tier: prefill.suggestedTier as AltaCardTierCode | undefined,
    limit: prefill.suggestedLimit != null ? String(prefill.suggestedLimit) : undefined,
    rate: prefill.suggestedRate != null ? String(prefill.suggestedRate) : undefined,
  };
}
