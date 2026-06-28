"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { CompanyRelationshipRecommendationRow } from "@/lib/bank/company-relationship-intelligence-types";
import { COMPANY_RECOMMENDATION_TYPE_LABELS } from "@/lib/bank/company-relationship-recommendation-config";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import {
  acceptCompanyRecommendationRecord,
  dismissCompanyRecommendationRecord,
  generateCompanyRelationshipRecommendationsRecord,
  markCompanyRecommendationReviewedRecord,
} from "@/lib/internal/company-relationship-intelligence.functions";

function formatAction(rec: CompanyRelationshipRecommendationRow): string {
  const parts: string[] = [];
  if (rec.recommendedLimit != null) parts.push(`Limit ${formatAltaCardCurrency(rec.recommendedLimit)}`);
  if (rec.recommendedRate != null) parts.push(`Rate ${rec.recommendedRate}%`);
  if (rec.recommendedTier) parts.push(`Tier ${rec.recommendedTier}`);
  return parts.join(" · ") || rec.summary;
}

export function CompanyRelationshipRecommendationsPanel({
  companyId,
  recommendations: initial,
}: {
  companyId: string;
  recommendations: CompanyRelationshipRecommendationRow[];
}) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function regenerate() {
    setBusy("generate");
    try {
      const rows = await generateCompanyRelationshipRecommendationsRecord({ data: companyId });
      setRecommendations(rows);
      await router.invalidate();
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, action: "review" | "dismiss" | "accept") {
    setBusy(id);
    try {
      const fn =
        action === "review"
          ? markCompanyRecommendationReviewedRecord
          : action === "dismiss"
            ? dismissCompanyRecommendationRecord
            : acceptCompanyRecommendationRecord;
      const updated = await fn({ data: id });
      setRecommendations((rows) => rows.map((r) => (r.id === id ? updated : r)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-gold/25 bg-gold/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Company recommendations
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Business-only recommendations — separate from personal Relationship Intelligence.
          </p>
        </div>
        <button
          type="button"
          disabled={busy === "generate"}
          onClick={() => void regenerate()}
          className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-60"
        >
          {busy === "generate" ? "Generating…" : "Regenerate"}
        </button>
      </div>

      {recommendations.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">No company recommendations yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {recommendations.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                    {COMPANY_RECOMMENDATION_TYPE_LABELS[rec.recommendationType]}
                  </p>
                  <p className="mt-1 text-[14px] font-medium">{rec.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{formatAction(rec)}</p>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{rec.status} · {rec.confidenceScore}%</span>
              </div>
              {rec.reasons.bullets.length > 0 ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                  {rec.reasons.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {rec.status === "ACTIVE" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === rec.id} onClick={() => void act(rec.id, "review")} className="rounded border border-border px-2 py-1 text-[11px]">Review</button>
                  <button type="button" disabled={busy === rec.id} onClick={() => void act(rec.id, "dismiss")} className="rounded border border-border px-2 py-1 text-[11px]">Dismiss</button>
                  <button type="button" disabled={busy === rec.id} onClick={() => void act(rec.id, "accept")} className="rounded border border-gold/40 px-2 py-1 text-[11px] text-gold">Accept</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
