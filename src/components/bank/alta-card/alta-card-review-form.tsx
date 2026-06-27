import { useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import type { AltaCardReviewFormContext, AltaCardReviewHistoryRow } from "@/lib/bank/alta-card-review-types";
import { ALTA_CARD_REVIEW_ACTIVE_MESSAGE, ALTA_CARD_REVIEW_CANCELLED_REAPPLY_MESSAGE, ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE, reviewDisplayStatusLabel } from "@/lib/bank/alta-card-review-helpers";
import type { SubmitAltaCardReviewAttachmentInput } from "@/lib/bank/alta-card-review-types";
import { resolveAltaCardThreadAttachmentMime } from "@/lib/storage/alta-card-thread-attachment.constants";
import {
  altaCardReviewDetailLink,
  altaCardReviewLink,
  altaCardReviewThreadLink,
} from "@/lib/bank/alta-card-navigation";
import type { AltaCardTypeCode } from "@/lib/bank/alta-card-types";
import { AltaCardRelationshipRecommendationPanel } from "@/components/bank/alta-card/alta-card-relationship-recommendation-panel";
import {
  submitAltaCardReviewRequest,
} from "@/lib/bank/alta-card-review.functions";
import { StatusBadge } from "@/components/internal/status-badge";
import { isTerminalThreadDecisionStatus } from "@/lib/bank/thread-decision-utils";

function tierUpgradeLabel(current: AltaCardTierCode, target: AltaCardTierCode): string {
  return `${ALTA_CARD_TIER_LABELS[current]} → ${ALTA_CARD_TIER_LABELS[target]}`;
}

function altaCardTypeScopeLabel(cardType: string): string {
  return cardType === "business" ? "Business" : "Personal";
}

function formatTierWithScope(tier: AltaCardTierCode, cardType: string): string {
  return `${ALTA_CARD_TIER_LABELS[tier]} · ${altaCardTypeScopeLabel(cardType)}`;
}

function reviewNavCard(context: AltaCardReviewFormContext, cardId: string) {
  return {
    id: cardId,
    cardType: context.card.cardType as AltaCardTypeCode,
    companyId: context.card.companyId,
  };
}

function reviewNavCardFromReview(
  cardId: string,
  review: import("@/lib/bank/alta-card-review-types").AltaCardReviewRequestRow,
) {
  return {
    id: cardId,
    cardType: review.cardType as AltaCardTypeCode,
    companyId: review.companyId,
  };
}

function fileSelectionKey(file: File): string {
  return `${file.name}-${file.lastModified}-${file.size}`;
}

const MAX_REVIEW_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read file."));
        return;
      }
      const comma = reader.result.indexOf(",");
      resolve(comma >= 0 ? reader.result.slice(comma + 1) : reader.result);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function buildAttachmentPayloads(
  files: File[],
): Promise<SubmitAltaCardReviewAttachmentInput[]> {
  const payloads: SubmitAltaCardReviewAttachmentInput[] = [];
  for (const file of files) {
    const mimeType = resolveAltaCardThreadAttachmentMime(file);
    if (!mimeType) {
      throw new Error(`File type not supported: ${file.name}`);
    }
    if (file.size > MAX_REVIEW_ATTACHMENT_BYTES) {
      throw new Error(`File exceeds 15 MB limit: ${file.name}`);
    }
    payloads.push({
      fileName: file.name,
      mimeType,
      base64: await readFileAsBase64(file),
    });
  }
  return payloads;
}

function AltaCardReviewHistorySection({
  cardId,
  cardType,
  companyId,
  reviews,
}: {
  cardId: string;
  cardType: string;
  companyId: string | null;
  reviews: AltaCardReviewHistoryRow[];
}) {
  if (reviews.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface-1/80 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Past reviews
        </h3>
        <p className="mt-3 text-[13px] text-muted-foreground">No account reviews on file yet.</p>
      </section>
    );
  }

  const navCard = {
    id: cardId,
    cardType: cardType as AltaCardTypeCode,
    companyId,
  };

  return (
    <section className="rounded-xl border border-border bg-surface-1/80 p-6">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Past reviews
      </h3>
      <ul className="mt-4 divide-y divide-border/60">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <Link
                {...altaCardReviewDetailLink(navCard, review.id)}
                className="font-medium hover:text-gold"
              >
                {review.createdAtLabel}
              </Link>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{review.requestedChangesSummary}</p>
              {review.reviewedAtLabel ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Decision · {review.reviewedAtLabel}
                </p>
              ) : null}
            </div>
            <StatusBadge status={reviewDisplayStatusLabel(review, "user")} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AltaCardReviewForm({
  context,
  cardId,
}: {
  context: AltaCardReviewFormContext;
  cardId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [requestLimit, setRequestLimit] = useState(false);
  const [requestRate, setRequestRate] = useState(false);
  const [requestTier, setRequestTier] = useState(false);
  const [requestedLimit, setRequestedLimit] = useState("");
  const [requestedRate, setRequestedRate] = useState("");
  const [requestedTier, setRequestedTier] = useState<AltaCardTierCode | "">(
    context.eligibleTierUpgrades[0] ?? "",
  );
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rel = context.relationship;
  const eligibility = context.eligibility;
  const showGoldUpsell = context.card.tier === "black" && !context.isPrivateClient;

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    setFiles((prev) => {
      const existing = new Set(prev.map(fileSelectionKey));
      const next = [...prev];
      for (const file of picked) {
        const key = fileSelectionKey(file);
        if (!existing.has(key)) {
          next.push(file);
          existing.add(key);
        }
      }
      return next;
    });
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((file) => fileSelectionKey(file) !== key));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!eligibility.canRequestReview) {
      setError(eligibility.blockMessage ?? "You cannot submit an account review at this time.");
      return;
    }
    if (!requestLimit && !requestRate && !requestTier) {
      setError("Select at least one requested improvement.");
      return;
    }
    if (requestTier && !requestedTier) {
      setError("Select a tier upgrade option.");
      return;
    }
    if (requestTier && requestedTier === "gold" && !context.isPrivateClient) {
      setError("Alta Gold is available exclusively through Alta Private.");
      return;
    }

    setLoading(true);
    try {
      const attachmentFiles = files.length > 0 ? await buildAttachmentPayloads(files) : undefined;
      const { reviewId } = await submitAltaCardReviewRequest({
        data: {
          cardId,
          requestLimitIncrease: requestLimit,
          requestRateReduction: requestRate,
          requestTierUpgrade: requestTier,
          requestedLimit: requestLimit && requestedLimit.trim() ? Number(requestedLimit) : undefined,
          requestedRate: requestRate && requestedRate.trim() ? Number(requestedRate) : undefined,
          requestedTier: requestTier && requestedTier ? requestedTier : undefined,
          notes: notes.trim() || undefined,
          attachmentFiles,
        },
      });

      await router.navigate(altaCardReviewDetailLink(reviewNavCard(context, cardId), reviewId));
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Submission failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!eligibility.canRequestReview) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-surface-1/80 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Account review</p>
          <h2 className="mt-2 font-serif text-[22px]">
            {eligibility.hasActiveReview ? "Review in progress" : "Review unavailable"}
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground">
            {eligibility.blockMessage ??
              (eligibility.hasActiveReview
                ? ALTA_CARD_REVIEW_ACTIVE_MESSAGE
                : "You cannot submit an account review at this time.")}
          </p>
          {eligibility.hasActiveReview && eligibility.activeReviewId ? (
            <Link
              {...altaCardReviewDetailLink(reviewNavCard(context, cardId), eligibility.activeReviewId)}
              className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
            >
              View active review →
            </Link>
          ) : null}
        </div>
        <AltaCardRelationshipRecommendationPanel recommendation={rel} />
        <AltaCardReviewHistorySection
          cardId={cardId}
          cardType={context.card.cardType}
          companyId={context.card.companyId}
          reviews={context.reviewHistory}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      <section className="rounded-xl border border-border bg-surface-1/80 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Current terms
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-[14px]">
          <div>
            <dt className="text-muted-foreground">Tier</dt>
            <dd className="mt-1 font-medium">
              {formatTierWithScope(context.card.tier, context.card.cardType)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Credit limit</dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(context.card.creditLimit)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Interest rate</dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardRate(context.card.interestRate)}
            </dd>
          </div>
        </dl>
      </section>

      <AltaCardRelationshipRecommendationPanel recommendation={rel} />

      <section className="rounded-xl border border-border bg-surface-1/80 p-6 space-y-5">
        <h3 className="font-serif text-[18px]">Requested improvements</h3>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={requestLimit}
            onChange={(e) => setRequestLimit(e.target.checked)}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="block text-[14px] font-medium">Higher credit limit</span>
            {requestLimit ? (
              <input
                type="number"
                min={context.card.creditLimit + 1}
                placeholder="Requested limit (optional)"
                value={requestedLimit}
                onChange={(e) => setRequestedLimit(e.target.value)}
                className="mt-2 w-full max-w-xs rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px]"
              />
            ) : null}
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={requestRate}
            onChange={(e) => setRequestRate(e.target.checked)}
            className="mt-1"
          />
          <span className="flex-1">
            <span className="block text-[14px] font-medium">Lower interest rate</span>
            {requestRate ? (
              <input
                type="number"
                step="0.01"
                max={context.card.interestRate - 0.01}
                placeholder="Requested rate % (optional)"
                value={requestedRate}
                onChange={(e) => setRequestedRate(e.target.value)}
                className="mt-2 w-full max-w-xs rounded-lg border border-border bg-surface-2 px-3 py-2 font-mono text-[13px]"
              />
            ) : null}
          </span>
        </label>

        {context.eligibleTierUpgrades.length > 0 ? (
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={requestTier}
              onChange={(e) => setRequestTier(e.target.checked)}
              className="mt-1"
            />
            <span className="flex-1">
              <span className="block text-[14px] font-medium">Card tier upgrade</span>
              {requestTier ? (
                <select
                  value={requestedTier}
                  onChange={(e) => setRequestedTier(e.target.value as AltaCardTierCode)}
                  className="mt-2 w-full max-w-xs rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px]"
                >
                  {context.eligibleTierUpgrades.map((tier) => (
                    <option key={tier} value={tier}>
                      {tierUpgradeLabel(context.card.tier, tier)}
                    </option>
                  ))}
                </select>
              ) : null}
            </span>
          </label>
        ) : null}

        {showGoldUpsell ? (
          <div className="rounded-lg border border-border bg-surface-2/60 p-4 text-[13px]">
            <p className="font-medium">Alta Gold is available exclusively through Alta Private.</p>
            <p className="mt-2 text-muted-foreground">
              Alta Private clients receive relationship-based pricing, negotiated credit facilities,
              and dedicated banking services.
            </p>
            <Link
              to="/bank/private"
              className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold hover:underline"
            >
              Learn more
            </Link>
          </div>
        ) : null}

      </section>

      <section className="rounded-xl border border-border bg-surface-1/80 p-6 space-y-4">
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Reason for request
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[14px]"
            placeholder="Tell us why you're requesting a review…"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Supporting documents
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFilesSelected}
            className="sr-only"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-1"
            >
              {files.length > 0 ? "Add more files" : "Choose files"}
            </button>
            {files.length > 0 ? (
              <span className="text-[13px] text-muted-foreground">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">Optional · PDF, Word, or images</span>
            )}
          </div>
          {files.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {files.map((file) => {
                const key = fileSelectionKey(file);
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[13px] text-foreground">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(key)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-1 hover:text-foreground"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </section>

      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg border border-border bg-surface-2 px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.18em] text-foreground transition-colors hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[240px]"
      >
        {loading ? "Submitting…" : "Submit review request"}
      </button>
    </form>
      {context.reviewHistory.length > 0 ? (
        <AltaCardReviewHistorySection
          cardId={cardId}
          cardType={context.card.cardType}
          companyId={context.card.companyId}
          reviews={context.reviewHistory}
        />
      ) : null}
    </div>
  );
}

export function AltaCardReviewDetailView({
  review,
  cardId,
}: {
  review: import("@/lib/bank/alta-card-review-types").AltaCardReviewRequestRow;
  cardId: string;
}) {
  const isPartial = review.status === "partially_approved";
  const isTerminal = isTerminalThreadDecisionStatus(review.status);

  return (
    <div className="space-y-8">
      <Link
        {...altaCardReviewLink(reviewNavCardFromReview(cardId, review))}
        className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← All reviews
      </Link>
      <div className="rounded-xl border border-border bg-surface-1/80 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Account review</p>
        <h2 className="mt-2 font-serif text-[24px]">Request Account Review</h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-[14px]">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={reviewDisplayStatusLabel(review, "user")} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Submitted</dt>
            <dd className="mt-1">{review.createdAtLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Correspondence</dt>
            <dd className="mt-1">Alta Credit Desk</dd>
          </div>
          {review.reviewedAt ? (
            <div>
              <dt className="text-muted-foreground">Decision date</dt>
              <dd className="mt-1">{review.reviewedAtLabel}</dd>
            </div>
          ) : null}
        </dl>

        <Link
          {...altaCardReviewThreadLink(reviewNavCardFromReview(cardId, review), review.id)}
          className="mt-5 inline-block rounded-lg border border-border bg-surface-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-surface-1"
        >
          {isTerminal ? "View secure deal room" : "Open secure deal room"}
        </Link>
        {isTerminal ? (
          <p className="mt-3 text-[13px] text-muted-foreground">
            This secure deal room is closed. Your decision is recorded above and in the deal room
            message history.
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-surface-1/80 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Requested improvements
        </h3>
        <ul className="mt-4 space-y-3 text-[14px]">
          {review.requestLimitIncrease ? (
            <li>
              Higher credit limit
              {review.requestedLimit != null
                ? ` — ${formatAltaCardCurrency(review.requestedLimit)}`
                : ""}
            </li>
          ) : null}
          {review.requestRateReduction ? (
            <li>
              Lower interest rate
              {review.requestedRate != null ? ` — ${formatAltaCardRate(review.requestedRate)}` : ""}
            </li>
          ) : null}
          {review.requestTierUpgrade && review.requestedTier ? (
            <li>
              Tier upgrade — {ALTA_CARD_TIER_LABELS[review.currentTier]} →{" "}
              {ALTA_CARD_TIER_LABELS[review.requestedTier]}
            </li>
          ) : null}
        </ul>
        {review.notes ? (
          <p className="mt-4 text-[13px] text-muted-foreground">{review.notes}</p>
        ) : null}
      </section>

      {isTerminal ? (
        <section className="rounded-xl border border-gold/30 bg-gold/5 p-6">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Decision
          </h3>
          <div className="mt-2">
            <StatusBadge status={review.statusLabel} />
          </div>
          {review.decisionNote ? (
            <p className="mt-2 text-[14px]">{review.decisionNote}</p>
          ) : null}
          {(review.status === "approved" || isPartial || review.status === "denied") ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              {ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE}
            </p>
          ) : null}
          {review.status === "cancelled" ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              {ALTA_CARD_REVIEW_CANCELLED_REAPPLY_MESSAGE}
            </p>
          ) : null}

          {review.status === "approved" || isPartial ? (
            <dl className="mt-4 space-y-3 text-[14px]">
              {review.approvedLimitIncrease && review.approvedLimit != null ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {review.requestLimitIncrease ? (
                    <div>
                      <dt className="text-muted-foreground">Requested limit</dt>
                      <dd className="font-mono">
                        {review.requestedLimit != null
                          ? formatAltaCardCurrency(review.requestedLimit)
                          : "—"}
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="text-muted-foreground">Previous limit</dt>
                      <dd className="font-mono">{formatAltaCardCurrency(review.currentLimit)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">New limit</dt>
                    <dd className="font-mono">{formatAltaCardCurrency(review.approvedLimit)}</dd>
                  </div>
                </div>
              ) : review.requestLimitIncrease ? (
                <div>
                  <dt className="text-muted-foreground">Credit limit</dt>
                  <dd>Not approved</dd>
                </div>
              ) : null}
              {review.approvedRateReduction && review.approvedRate != null ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {review.requestRateReduction ? (
                    <div>
                      <dt className="text-muted-foreground">Requested rate</dt>
                      <dd className="font-mono">
                        {review.requestedRate != null ? formatAltaCardRate(review.requestedRate) : "—"}
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="text-muted-foreground">Previous rate</dt>
                      <dd className="font-mono">{formatAltaCardRate(review.currentRate)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">New rate</dt>
                    <dd className="font-mono">{formatAltaCardRate(review.approvedRate)}</dd>
                  </div>
                </div>
              ) : review.requestRateReduction ? (
                <div>
                  <dt className="text-muted-foreground">Interest rate</dt>
                  <dd>Not approved</dd>
                </div>
              ) : null}
              {review.approvedTierUpgrade && review.approvedTier ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {review.requestTierUpgrade ? (
                    <div>
                      <dt className="text-muted-foreground">Requested tier</dt>
                      <dd>
                        {review.requestedTier ? ALTA_CARD_TIER_LABELS[review.requestedTier] : "—"}
                      </dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="text-muted-foreground">Previous tier</dt>
                      <dd>{ALTA_CARD_TIER_LABELS[review.currentTier]}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">New tier</dt>
                    <dd>{ALTA_CARD_TIER_LABELS[review.approvedTier]}</dd>
                  </div>
                </div>
              ) : review.requestTierUpgrade ? (
                <div>
                  <dt className="text-muted-foreground">Tier upgrade</dt>
                  <dd>Not approved</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
