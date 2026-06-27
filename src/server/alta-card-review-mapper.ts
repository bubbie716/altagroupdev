import type { AltaCardReviewStatus, AltaCardTier } from "@prisma/client";
import type { AltaCardReviewStatusCode } from "@/lib/bank/alta-card-review-types";
import type { AltaCardTierCode } from "@/lib/bank/alta-card-types";

const REVIEW_STATUS_FROM_DB: Record<AltaCardReviewStatus, AltaCardReviewStatusCode> = {
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  NEEDS_INFORMATION: "needs_information",
  APPROVED: "approved",
  PARTIALLY_APPROVED: "partially_approved",
  DENIED: "denied",
  CANCELLED: "cancelled",
};

const REVIEW_STATUS_TO_DB: Record<AltaCardReviewStatusCode, AltaCardReviewStatus> = {
  submitted: "SUBMITTED",
  under_review: "UNDER_REVIEW",
  needs_information: "NEEDS_INFORMATION",
  approved: "APPROVED",
  partially_approved: "PARTIALLY_APPROVED",
  denied: "DENIED",
  cancelled: "CANCELLED",
};

export function toAltaCardReviewStatusCode(status: AltaCardReviewStatus): AltaCardReviewStatusCode {
  return REVIEW_STATUS_FROM_DB[status];
}

export function toDbAltaCardReviewStatus(status: AltaCardReviewStatusCode): AltaCardReviewStatus {
  return REVIEW_STATUS_TO_DB[status];
}

export { toAltaCardTierCode, toAltaCardTypeCode, toDbAltaCardTier } from "@/server/alta-card-mapper";

export function isTerminalReviewStatus(status: AltaCardReviewStatusCode): boolean {
  return ["approved", "partially_approved", "denied", "cancelled"].includes(status);
}
