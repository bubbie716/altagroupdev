import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import type { ProcessAltaCardReviewDecisionInput } from "@/lib/bank/alta-card-review-types";
import {
  fetchInternalAltaCardReviewDetail,
  processAltaCardReviewDecision,
} from "@/lib/bank/alta-card-review.functions";
import { reviewDisplayStatusLabel } from "@/lib/bank/alta-card-review-helpers";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdmin } from "@/lib/auth/permissions";

export const Route = createFileRoute("/internal/alta-card/reviews/$reviewId/")({
  loader: async ({ params }) => {
    const detail = await fetchInternalAltaCardReviewDetail({ data: params.reviewId });
    return { detail, reviewId: params.reviewId };
  },
  head: () => ({ meta: [{ title: "Account Review Detail — Alta Internal" }] }),
  component: InternalAltaCardReviewDetailPage,
});

function InternalAltaCardReviewDetailPage() {
  const { detail, reviewId } = Route.useLoaderData();
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const review = detail.review;
  const rel = detail.relationship;
  const open = ["submitted", "under_review", "needs_information"].includes(review.status);

  const [reason, setReason] = useState("");
  const [approveLimit, setApproveLimit] = useState(review.requestLimitIncrease);
  const [approvedLimit, setApprovedLimit] = useState(
    String(review.requestedLimit ?? rel?.recommendedCreditLimit ?? review.currentLimit),
  );
  const [approveRate, setApproveRate] = useState(review.requestRateReduction);
  const [approvedRate, setApprovedRate] = useState(
    String(review.requestedRate ?? rel?.recommendedInterestRate ?? review.currentRate),
  );
  const [approveTier, setApproveTier] = useState(review.requestTierUpgrade);
  const [approvedTier, setApprovedTier] = useState<AltaCardTierCode>(
    review.requestedTier ?? rel?.recommendedTier ?? review.currentTier,
  );
  const [goldOverride, setGoldOverride] = useState(false);

  function requireReason(): string {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new Error("Decision reason is required.");
    }
    return trimmed;
  }

  async function submitDecision(input: Omit<ProcessAltaCardReviewDecisionInput, "reviewId" | "reason">) {
    await processAltaCardReviewDecision({
      data: {
        reviewId,
        reason: requireReason(),
        ...input,
      },
    });
  }

  return (
    <InternalPageShell
      title="Account review"
      description="Relationship review for existing Alta Card holders."
    >
      <Link
        to="/internal/alta-card/reviews"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← Reviews queue
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <h3 className="font-serif text-[18px]">{review.applicantUsername}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Card ····{review.cardLastFour}
            </p>
            <div className="mt-2">
              <StatusBadge status={reviewDisplayStatusLabel(review, "internal")} />
            </div>
            {review.companyName ? (
              <p className="mt-1 text-[13px]">Company: {review.companyName}</p>
            ) : null}
            <Link
              to="/internal/alta-card/$cardId"
              params={{ cardId: review.altaCardId }}
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold hover:underline"
            >
              View card →
            </Link>
          </section>

          <section className="rounded-xl border border-gold/30 bg-gold/5 p-5">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Relationship summary
            </h4>
            {rel ? (
              <>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Score {rel.relationshipScore}/100 — recommendation only
                </p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-[13px]">
                  <div>
                    <dt className="text-muted-foreground">Tier</dt>
                    <dd>{ALTA_CARD_TIER_LABELS[rel.recommendedTier]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Limit</dt>
                    <dd className="font-mono">{formatAltaCardCurrency(rel.recommendedCreditLimit)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Rate</dt>
                    <dd className="font-mono">{formatAltaCardRate(rel.recommendedInterestRate)}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Relationship intelligence not available.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Current terms
            </h4>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-4">
                <span>Tier</span>
                <span>{ALTA_CARD_TIER_LABELS[review.currentTier]}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Limit</span>
                <span className="font-mono">{formatAltaCardCurrency(review.currentLimit)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Rate</span>
                <span className="font-mono">{formatAltaCardRate(review.currentRate)}</span>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Requested changes
            </h4>
            <ul className="mt-3 space-y-2 text-[13px]">
              {review.requestLimitIncrease ? (
                <li>
                  Higher limit
                  {review.requestedLimit != null
                    ? ` — ${formatAltaCardCurrency(review.requestedLimit)}`
                    : ""}
                </li>
              ) : null}
              {review.requestRateReduction ? (
                <li>
                  Lower rate
                  {review.requestedRate != null ? ` — ${formatAltaCardRate(review.requestedRate)}` : ""}
                </li>
              ) : null}
              {review.requestTierUpgrade && review.requestedTier ? (
                <li>
                  Tier — {ALTA_CARD_TIER_LABELS[review.currentTier]} →{" "}
                  {ALTA_CARD_TIER_LABELS[review.requestedTier]}
                </li>
              ) : null}
            </ul>
            {review.notes ? (
              <p className="mt-3 text-[13px] text-muted-foreground">{review.notes}</p>
            ) : null}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Secure deal room
              </h4>
              <Link
                to="/internal/alta-card/reviews/$reviewId/thread"
                params={{ reviewId }}
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold hover:underline"
              >
                Open deal room →
              </Link>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Messages are handled by Alta Credit Desk. Use the secure deal room for all
              correspondence with the cardholder.
            </p>
            {!open ? (
              <p className="mt-3 text-[13px]">
                Deal room status:{" "}
                <span className="font-medium text-muted-foreground">Closed</span>
                {" · "}
                Decision: <StatusBadge status={review.statusLabel} dot={false} />
              </p>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Deal room status is updated by staff from the secure deal room controls.
              </p>
            )}
          </section>

          {open ? (
            <section className="rounded-xl border border-border bg-surface-1/80 p-5 space-y-4">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Review decision
              </h4>
              <p className="text-[12px] text-muted-foreground">
                Check the terms to apply, then approve. Unchecked items are not changed.
              </p>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={approveLimit}
                    onChange={(e) => setApproveLimit(e.target.checked)}
                  />
                  Update credit limit
                  {review.requestLimitIncrease ? (
                    <span className="text-muted-foreground">(requested)</span>
                  ) : null}
                </label>
                <p className="text-[12px] text-muted-foreground">
                  Current: {formatAltaCardCurrency(review.currentLimit)}
                </p>
                <input
                  type="number"
                  value={approvedLimit}
                  onChange={(e) => setApprovedLimit(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px]"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={approveRate}
                    onChange={(e) => setApproveRate(e.target.checked)}
                  />
                  Update interest rate
                  {review.requestRateReduction ? (
                    <span className="text-muted-foreground">(requested)</span>
                  ) : null}
                </label>
                <p className="text-[12px] text-muted-foreground">
                  Current: {formatAltaCardRate(review.currentRate)}
                </p>
                <input
                  type="number"
                  step="0.01"
                  value={approvedRate}
                  onChange={(e) => setApprovedRate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px]"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={approveTier}
                    onChange={(e) => setApproveTier(e.target.checked)}
                  />
                  Update card tier
                  {review.requestTierUpgrade ? (
                    <span className="text-muted-foreground">(requested)</span>
                  ) : null}
                </label>
                <p className="text-[12px] text-muted-foreground">
                  Current: {ALTA_CARD_TIER_LABELS[review.currentTier]}
                </p>
                <select
                  value={approvedTier}
                  onChange={(e) => setApprovedTier(e.target.value as AltaCardTierCode)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]"
                >
                  {(["white", "navy", "black", "gold"] as AltaCardTierCode[]).map((tier) => (
                    <option key={tier} value={tier}>
                      {ALTA_CARD_TIER_LABELS[tier]}
                    </option>
                  ))}
                </select>
                {admin && approvedTier === "gold" ? (
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={goldOverride}
                      onChange={(e) => setGoldOverride(e.target.checked)}
                    />
                    Gold override (non-private)
                  </label>
                ) : null}
              </div>

              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Decision reason (required)"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]"
              />

              <div className="flex flex-wrap gap-2">
                <BankReviewButton
                  label="Approve"
                  variant="primary"
                  onAction={async () => {
                    if (!approveLimit && !approveRate && !approveTier) {
                      throw new Error("Select at least one term to approve.");
                    }
                    await submitDecision({
                      action: "approve",
                      approveLimitIncrease: approveLimit,
                      approvedLimit: approveLimit ? Number(approvedLimit) : undefined,
                      approveRateReduction: approveRate,
                      approvedRate: approveRate ? Number(approvedRate) : undefined,
                      approveTierUpgrade: approveTier,
                      approvedTier: approveTier ? approvedTier : undefined,
                      goldOverride,
                    });
                  }}
                />
                <BankReviewButton
                  label="Deny"
                  variant="danger"
                  onAction={async () => {
                    await submitDecision({ action: "deny" });
                  }}
                />
                <BankReviewButton
                  label="Close review"
                  onAction={async () => {
                    const trimmed = reason.trim();
                    await processAltaCardReviewDecision({
                      data: {
                        reviewId,
                        action: "cancel",
                        reason: trimmed || "Review closed",
                      },
                    });
                  }}
                />
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-surface-1/80 p-5">
              <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Decision
              </h4>
              <div className="mt-2">
                <StatusBadge status={review.statusLabel} />
              </div>
              {review.decisionNote ? (
                <p className="mt-2 text-[13px] text-muted-foreground">{review.decisionNote}</p>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </InternalPageShell>
  );
}
