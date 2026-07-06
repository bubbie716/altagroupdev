"use client";

import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { RelationshipRecommendationRow } from "@/lib/bank/relationship-intelligence-types";
import {
  acceptRelationshipRecommendationRecord,
  dismissRelationshipRecommendationRecord,
  generateRelationshipRecommendationsRecord,
  markRelationshipRecommendationReviewedRecord,
  useRelationshipRecommendationRecord,
} from "@/lib/internal/relationship-intelligence.functions";
import {
  formatRecommendedAction,
  recommendationTypeLabel,
} from "@/lib/bank/relationship-recommendation-display";
import { formatActivityDateTime } from "@/lib/format-datetime";

function StatusPill({ status }: { status: RelationshipRecommendationRow["status"] }) {
  const tone =
    status === "ACTIVE"
      ? "border-gold/40 text-gold"
      : status === "ACCEPTED"
        ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
        : status === "DISMISSED"
          ? "border-muted-foreground/30 text-muted-foreground"
          : status === "EXPIRED"
            ? "border-muted-foreground/20 text-muted-foreground"
            : "border-border text-foreground";
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function RecommendationActionLink({
  rec,
  userId,
  onAccepted,
}: {
  rec: RelationshipRecommendationRow;
  userId: string;
  onAccepted: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const actionPath = rec.reasons.actionPath;
  if (!actionPath) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          await useRelationshipRecommendationRecord({
            data: { recommendationId: rec.id, context: "CUSTOMER_PROFILE" },
          });
          await onAccepted();
          await navigate({
            to: actionPath.to,
            params: actionPath.params,
            search: actionPath.search,
          });
        })();
      }}
      className="rounded border border-gold/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:bg-gold/5"
    >
      Open workflow →
    </button>
  );
}

export function RelationshipRecommendationsPanel({
  userId,
  recommendations,
  showGenerate = true,
}: {
  userId: string;
  recommendations: RelationshipRecommendationRow[];
  showGenerate?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = recommendations.filter((r) => r.status === "ACTIVE");
  const history = recommendations.filter((r) => r.status !== "ACTIVE");

  async function runAction(id: string, action: "review" | "dismiss" | "accept") {
    setBusyId(id);
    setError(null);
    try {
      if (action === "review") {
        await markRelationshipRecommendationReviewedRecord({ data: { id } });
      } else if (action === "dismiss") {
        await dismissRelationshipRecommendationRecord({ data: { id } });
      } else {
        await acceptRelationshipRecommendationRecord({ data: { id } });
      }
      await router.invalidate();
    } catch {
      setError("Could not update recommendation.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await generateRelationshipRecommendationsRecord({ data: userId });
      await router.invalidate();
    } catch {
      setError("Could not generate recommendations.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Recommendations
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Read-only product suggestions from the relationship profile. Admins decide — nothing auto-applies.
          </p>
        </div>
        {showGenerate ? (
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate()}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-surface-2/80 disabled:opacity-60"
          >
            {generating ? SUBMITTING_COPY.generating : "Generate recommendations"}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

      {active.length === 0 ? (
        <p className="mt-6 text-[13px] text-muted-foreground">
          No active recommendations. Generate from the latest relationship profile.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {active.map((rec) => (
            <li key={rec.id} className="rounded-lg border border-border/70 bg-surface-2/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
                    {recommendationTypeLabel(rec.recommendationType)}
                  </p>
                  <h4 className="mt-1 text-[15px] font-medium">{rec.title}</h4>
                  <p className="mt-1 text-[13px] text-muted-foreground">{rec.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={rec.status} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Confidence {rec.confidenceScore}
                  </span>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-[13px]">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Recommended action
                  </dt>
                  <dd className="mt-1">{formatRecommendedAction(rec)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Generated
                  </dt>
                  <dd className="mt-1">{formatActivityDateTime(rec.createdAt)}</dd>
                </div>
              </dl>

              {rec.reasons.bullets.length > 0 ? (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                  {rec.reasons.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === rec.id}
                  onClick={() => void runAction(rec.id, "review")}
                  className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-60"
                >
                  Review
                </button>
                <button
                  type="button"
                  disabled={busyId === rec.id}
                  onClick={() => void runAction(rec.id, "dismiss")}
                  className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] hover:bg-surface-2 disabled:opacity-60"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={busyId === rec.id}
                  onClick={() => void runAction(rec.id, "accept")}
                  className="rounded border border-gold/40 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:bg-gold/5 disabled:opacity-60"
                >
                  Accept / Apply
                </button>
                <RecommendationActionLink
                  rec={rec}
                  userId={userId}
                  onAccepted={async () => {
                    await markRelationshipRecommendationReviewedRecord({ data: { id: rec.id } });
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 ? (
        <div className="mt-8 border-t border-border/60 pt-6">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Prior recommendations
          </h4>
          <ul className="mt-4 space-y-2 text-[13px]">
            {history.slice(0, 8).map((rec) => (
              <li key={rec.id} className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span>
                  {recommendationTypeLabel(rec.recommendationType)} — {rec.title}
                </span>
                <StatusPill status={rec.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
