import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";
import type { AltaCardRelationshipRecommendation } from "@/lib/bank/alta-card-types";
import type { AltaCardThreadAttachment } from "@/lib/bank/alta-card-application-thread-types";
import type { AltaCardReviewThreadStatusCode } from "@/lib/bank/alta-card-review-thread-types";

export type AltaCardReviewStatusCode =
  | "submitted"
  | "under_review"
  | "needs_information"
  | "approved"
  | "partially_approved"
  | "denied"
  | "cancelled";

export const ALTA_CARD_REVIEW_STATUS_LABELS: Record<AltaCardReviewStatusCode, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  needs_information: "Needs information",
  approved: "Approved",
  partially_approved: "Partially approved",
  denied: "Denied",
  cancelled: "Cancelled",
};

export type SubmitAltaCardReviewAttachmentInput = {
  fileName: string;
  mimeType?: string;
  base64: string;
};

export type SubmitAltaCardReviewInput = {
  cardId: string;
  requestLimitIncrease: boolean;
  requestRateReduction: boolean;
  requestTierUpgrade: boolean;
  requestedLimit?: number;
  requestedRate?: number;
  requestedTier?: AltaCardTierCode;
  notes?: string;
  initialAttachments?: AltaCardThreadAttachment[];
  attachmentFiles?: SubmitAltaCardReviewAttachmentInput[];
};

export type AltaCardReviewRequestRow = {
  id: string;
  altaCardId: string;
  cardLastFour: string;
  cardType: string;
  applicantUserId: string;
  applicantUsername: string;
  companyId: string | null;
  companyName: string | null;
  currentTier: AltaCardTierCode;
  currentLimit: number;
  currentRate: number;
  requestLimitIncrease: boolean;
  requestRateReduction: boolean;
  requestTierUpgrade: boolean;
  requestedLimit: number | null;
  requestedRate: number | null;
  requestedTier: AltaCardTierCode | null;
  notes: string | null;
  status: AltaCardReviewStatusCode;
  statusLabel: string;
  /** Secure deal room thread status; defaults to waiting on Alta when open. */
  threadStatus: AltaCardReviewThreadStatusCode | null;
  approvedLimit: number | null;
  approvedRate: number | null;
  approvedTier: AltaCardTierCode | null;
  approvedLimitIncrease: boolean | null;
  approvedRateReduction: boolean | null;
  approvedTierUpgrade: boolean | null;
  decisionNote: string | null;
  reviewedByUsername: string | null;
  reviewedAt: string | null;
  reviewedAtLabel: string | null;
  assignedStaffName: string | null;
  createdAt: string;
  createdAtLabel: string;
};

export type AltaCardReviewEligibility = {
  canRequestReview: boolean;
  hasActiveReview: boolean;
  activeReviewId: string | null;
  inCooldown: boolean;
  cooldownEndsAt: string | null;
  cooldownRemainingLabel: string | null;
  blockMessage: string | null;
};

export type AltaCardReviewFormContext = {
  card: {
    id: string;
    tier: AltaCardTierCode;
    creditLimit: number;
    interestRate: number;
    cardType: string;
    cardLastFour: string;
    companyId: string | null;
  };
  relationship: AltaCardRelationshipRecommendation | null;
  isPrivateClient: boolean;
  eligibleTierUpgrades: AltaCardTierCode[];
  eligibility: AltaCardReviewEligibility;
  reviewHistory: AltaCardReviewHistoryRow[];
  /** @deprecated Use eligibility.hasActiveReview */
  hasOpenReview: boolean;
  /** @deprecated Use eligibility.activeReviewId */
  openReviewId: string | null;
};

export type AltaCardReviewHistoryRow = {
  id: string;
  status: AltaCardReviewStatusCode;
  statusLabel: string;
  threadStatus: AltaCardReviewThreadStatusCode | null;
  createdAtLabel: string;
  reviewedAtLabel: string | null;
  requestedChangesSummary: string;
};

export type ProcessAltaCardReviewDecisionInput = {
  reviewId: string;
  action: "approve" | "deny" | "needs_information" | "cancel";
  reason: string;
  approveLimitIncrease?: boolean;
  approvedLimit?: number;
  approveRateReduction?: boolean;
  approvedRate?: number;
  approveTierUpgrade?: boolean;
  approvedTier?: AltaCardTierCode;
  goldOverride?: boolean;
};

export type InternalAltaCardReviewDetail = {
  review: AltaCardReviewRequestRow;
  relationship: AltaCardRelationshipRecommendation | null;
};

export type AltaCardReviewQueueRow = AltaCardReviewRequestRow & {
  requestedChangesSummary: string;
};
