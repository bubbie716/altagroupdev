import type { AltaCardApplicationThreadMessageRow } from "@/lib/bank/alta-card-application-thread-types";
import type { AltaCardReviewThreadMessageRow } from "@/lib/bank/alta-card-review-thread-types";
import { mapAltaCardReviewThreadMessagesToLoan } from "@/lib/bank/alta-card-review-thread-adapter";
import { mapAltaCardThreadMessagesToLoan } from "@/lib/bank/alta-card-thread-adapter";
import type { LoanApplicationThreadMessageRow } from "@/lib/bank/loan-application-thread-types";
import { stripAdminReasonFromCustomerThreadBody } from "@/lib/bank/secure-deal-room-system-copy";

export type ThreadViewVariant = "user" | "internal";

export type ThreadMessageAudience = "customer" | "internal";

/** True when the bubble should render on the right (dark / "you"). */
export function isOwnThreadMessage(
  message: LoanApplicationThreadMessageRow,
  variant: ThreadViewVariant,
  viewerUserId: string,
): boolean {
  if (message.senderRole === "system") return false;

  if (variant === "internal") {
    if (message.senderRole === "alta_staff") {
      return message.senderUserId != null && message.senderUserId === viewerUserId;
    }
    return false;
  }

  // Cardholder portal: Alta desk is always the counterparty (left), even when a staff
  // test account shares the same user id as the applicant on historical messages.
  if (message.senderRole === "alta_staff") return false;

  if (message.senderUserId != null) {
    return message.senderUserId === viewerUserId;
  }

  return message.senderRole === "applicant";
}

/** Backfill missing applicant sender ids for legacy thread rows. */
export function enrichLegacyThreadMessage<
  T extends Pick<LoanApplicationThreadMessageRow, "senderUserId" | "senderRole">,
>(message: T, thread: { applicantUserId: string }): T {
  if (message.senderUserId != null || message.senderRole !== "applicant") {
    return message;
  }
  return { ...message, senderUserId: thread.applicantUserId };
}

export function normalizeThreadMessage(
  product: "loan" | "alta-card" | "alta-card-review",
  message: unknown,
): LoanApplicationThreadMessageRow {
  if (product === "alta-card-review") {
    return mapAltaCardReviewThreadMessagesToLoan([message as AltaCardReviewThreadMessageRow])[0]!;
  }
  if (product === "alta-card") {
    return mapAltaCardThreadMessagesToLoan([message as AltaCardApplicationThreadMessageRow])[0]!;
  }
  return message as LoanApplicationThreadMessageRow;
}

export function sanitizeThreadMessageBodyForAudience(
  body: string | null,
  senderRole: LoanApplicationThreadMessageRow["senderRole"],
  audience: ThreadMessageAudience,
): string | null {
  if (!body || audience === "internal" || senderRole !== "system") return body;
  return stripAdminReasonFromCustomerThreadBody(body);
}
