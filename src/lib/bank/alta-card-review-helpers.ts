import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import type { AltaCardReviewStatusCode } from "@/lib/bank/alta-card-review-types";
import { ALTA_CARD_REVIEW_STATUS_LABELS } from "@/lib/bank/alta-card-review-types";
import type { AltaCardReviewThreadStatusCode } from "@/lib/bank/alta-card-review-thread-types";
import {
  ALTA_CARD_REVIEW_THREAD_STATUS_LABELS,
  ALTA_CARD_REVIEW_THREAD_STATUS_LABELS_INTERNAL,
} from "@/lib/bank/alta-card-review-thread-types";
import { ALTA_CARD_TIER_CONFIG, ALTA_CARD_TIER_ORDER } from "@/lib/bank/alta-card-tier-config";

/** Minimum days between completed account reviews for cardholders. */
export const ALTA_CARD_REVIEW_COOLDOWN_DAYS = 30;

export const ALTA_CARD_REVIEW_COOLDOWN_MS = ALTA_CARD_REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export const ALTA_CARD_REVIEW_ACTIVE_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_INFORMATION",
] as const;

export const ALTA_CARD_REVIEW_COOLDOWN_STATUSES = [
  "APPROVED",
  "PARTIALLY_APPROVED",
  "DENIED",
] as const;

/** Terminal review outcomes — used to find the latest completed review. */
export const ALTA_CARD_REVIEW_TERMINAL_STATUSES = [
  ...ALTA_CARD_REVIEW_COOLDOWN_STATUSES,
  "CANCELLED",
] as const;

export function reviewStatusTriggersCooldown(status: string): boolean {
  return (ALTA_CARD_REVIEW_COOLDOWN_STATUSES as readonly string[]).includes(status);
}

export const ALTA_CARD_REVIEW_ACTIVE_MESSAGE =
  "You already have an active account review in progress.";

export const ALTA_CARD_REVIEW_CANCELLED_REAPPLY_MESSAGE =
  "You may submit a new account review request immediately — no cooldown applies.";

export const ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE = `You must wait ${ALTA_CARD_REVIEW_COOLDOWN_DAYS} days before submitting another account review request.`;

export function formatReviewCancelledThreadMessage(reason: string): string {
  const trimmed = reason.trim();
  const lead = trimmed ? `Account review cancelled. ${trimmed}` : "Account review cancelled.";
  return `${lead} ${ALTA_CARD_REVIEW_CANCELLED_REAPPLY_MESSAGE}`;
}

export function formatReviewDeniedThreadMessage(reason: string): string {
  const trimmed = reason.trim();
  const lead = trimmed ? `Account review denied. ${trimmed}` : "Account review denied.";
  return `${lead} ${ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE}`;
}

/** Eligible tier targets for account review (strictly higher tiers; Black/Gold have no upgrade path here). */
export function getEligibleTierUpgrades(
  currentTier: AltaCardTierCode,
  isPrivateClient: boolean,
): AltaCardTierCode[] {
  if (currentTier === "black" || currentTier === "gold") return [];

  const currentOrder = ALTA_CARD_TIER_CONFIG[currentTier].sortOrder;
  return ALTA_CARD_TIER_ORDER.filter((tier) => {
    if (ALTA_CARD_TIER_CONFIG[tier].sortOrder <= currentOrder) return false;
    if (ALTA_CARD_TIER_CONFIG[tier].isPrivateOnly && !isPrivateClient) return false;
    return true;
  });
}

export function formatReviewChangesSummary(review: {
  requestLimitIncrease: boolean;
  requestRateReduction: boolean;
  requestTierUpgrade: boolean;
  requestedLimit: number | null;
  requestedRate: number | null;
  requestedTier: AltaCardTierCode | null;
}): string {
  const parts: string[] = [];
  if (review.requestLimitIncrease) {
    parts.push(review.requestedLimit != null ? `Limit → ƒ${review.requestedLimit.toLocaleString()}` : "Higher limit");
  }
  if (review.requestRateReduction) {
    parts.push(review.requestedRate != null ? `Rate → ${review.requestedRate}%` : "Lower rate");
  }
  if (review.requestTierUpgrade && review.requestedTier) {
    parts.push(`Tier → ${review.requestedTier}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

type ReviewDecisionThreadInput = {
  finalStatus: "APPROVED" | "PARTIALLY_APPROVED" | "DENIED";
  reason: string;
  currentLimit: number;
  currentRate: number;
  currentTier: AltaCardTierCode;
  requestLimitIncrease: boolean;
  requestRateReduction: boolean;
  requestTierUpgrade: boolean;
  approvedLimitIncrease: boolean | null;
  approvedRateReduction: boolean | null;
  approvedTierUpgrade: boolean | null;
  approvedLimit: number | null;
  approvedRate: number | null;
  approvedTier: AltaCardTierCode | null;
};

/** System message body when staff closes a review with approve / partial / deny. */
export function formatReviewDecisionThreadMessage(input: ReviewDecisionThreadInput): string {
  const reason = input.reason.trim();
  const headline =
    input.finalStatus === "APPROVED"
      ? "Account review approved."
      : input.finalStatus === "PARTIALLY_APPROVED"
        ? "Account review partially approved."
        : "Account review denied.";

  const approvedLines: string[] = [];
  if (input.approvedLimitIncrease && input.approvedLimit != null) {
    approvedLines.push(
      `Credit limit: ${formatAltaCardCurrency(input.approvedLimit)} (previously ${formatAltaCardCurrency(input.currentLimit)})`,
    );
  }
  if (input.approvedRateReduction && input.approvedRate != null) {
    approvedLines.push(
      `Interest rate: ${formatAltaCardRate(input.approvedRate)} (previously ${formatAltaCardRate(input.currentRate)})`,
    );
  }
  if (input.approvedTierUpgrade && input.approvedTier) {
    approvedLines.push(
      `Card tier: ${ALTA_CARD_TIER_LABELS[input.approvedTier]} (previously ${ALTA_CARD_TIER_LABELS[input.currentTier]})`,
    );
  }

  const declinedLines: string[] = [];
  if (input.requestLimitIncrease && input.approvedLimitIncrease !== true) {
    declinedLines.push("Credit limit increase");
  }
  if (input.requestRateReduction && input.approvedRateReduction !== true) {
    declinedLines.push("Interest rate reduction");
  }
  if (input.requestTierUpgrade && input.approvedTierUpgrade !== true) {
    declinedLines.push("Card tier upgrade");
  }

  const sections = [headline];
  if (approvedLines.length > 0) {
    sections.push("", "Approved terms:", ...approvedLines.map((line) => `• ${line}`));
  }
  if (declinedLines.length > 0) {
    sections.push("", "Not approved:", ...declinedLines.map((line) => `• ${line}`));
  }
  if (reason) {
    sections.push("", `Note: ${reason}`);
  }
  if (input.finalStatus === "APPROVED" || input.finalStatus === "PARTIALLY_APPROVED") {
    sections.push("", ALTA_CARD_REVIEW_COOLDOWN_APPLIES_MESSAGE);
  }
  return sections.join("\n");
}

export function formatReviewCooldownRemaining(cooldownEndsAt: Date, now = new Date()): string {
  const ms = cooldownEndsAt.getTime() - now.getTime();
  if (ms <= 0) return "";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}

export function formatReviewCooldownBlockMessage(cooldownEndsAt: Date, now = new Date()): string {
  const remaining = formatReviewCooldownRemaining(cooldownEndsAt, now);
  return remaining
    ? `You must wait ${ALTA_CARD_REVIEW_COOLDOWN_DAYS} days between account reviews. ${remaining}.`
    : `You must wait ${ALTA_CARD_REVIEW_COOLDOWN_DAYS} days between account reviews.`;
}

const TERMINAL_REVIEW_STATUSES: AltaCardReviewStatusCode[] = [
  "approved",
  "partially_approved",
  "denied",
  "cancelled",
];

/** Deal-room status for open reviews; decision label once closed. */
export function reviewDisplayStatusLabel(
  review: {
    status: AltaCardReviewStatusCode;
    threadStatus: AltaCardReviewThreadStatusCode | null;
  },
  variant: "user" | "internal" = "user",
): string {
  if (TERMINAL_REVIEW_STATUSES.includes(review.status)) {
    return ALTA_CARD_REVIEW_STATUS_LABELS[review.status];
  }

  const threadStatus = review.threadStatus ?? "waiting_on_alta";
  if (threadStatus === "waiting_on_applicant") {
    return variant === "internal"
      ? ALTA_CARD_REVIEW_THREAD_STATUS_LABELS_INTERNAL.waiting_on_applicant
      : ALTA_CARD_REVIEW_THREAD_STATUS_LABELS.waiting_on_applicant;
  }

  return variant === "internal"
    ? ALTA_CARD_REVIEW_THREAD_STATUS_LABELS_INTERNAL.waiting_on_alta
    : ALTA_CARD_REVIEW_THREAD_STATUS_LABELS.waiting_on_alta;
}
