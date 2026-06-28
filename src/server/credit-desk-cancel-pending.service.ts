import {
  ALTA_CARD_REVIEW_ACTIVE_STATUSES,
  formatReviewCancelledThreadMessage,
} from "@/lib/bank/alta-card-review-helpers";
import {
  buildAltaCardApplicationCancelledSystemMessage,
  buildLendingApplicationCancelledSystemMessage,
} from "@/lib/bank/secure-deal-room-system-copy";
import { writeAuditLog } from "@/server/audit.service";
import {
  BLOCKING_ALTA_CARD_APPLICATION_STATUSES,
} from "@/server/alta-card-application.service";
import { postAltaCardApplicationSystemMessage } from "@/server/alta-card-application-thread.service";
import { finalizeReviewThreadDecision } from "@/server/alta-card-review-thread.service";
import { closeThreadForApplicationIfOpen } from "@/server/loan-application-thread.service";
import { prisma } from "@/server/db";

export type CreditDeskCancellationSummary = {
  loanApplications: number;
  altaCardApplications: number;
  altaCardReviews: number;
};

const CREDIT_DESK_CANCELLED_NOTE =
  "Cancelled automatically because the Credit Desk was closed.";

export async function cancelPendingCreditApplicationsOnCreditDeskClose(
  actorUserId: string,
  reason: string,
): Promise<CreditDeskCancellationSummary> {
  const trimmedReason = reason.trim();
  const threadReason = trimmedReason || CREDIT_DESK_CANCELLED_NOTE;

  const [loanApplications, altaCardApplications, altaCardReviews] = await Promise.all([
    prisma.loanApplication.findMany({
      where: {
        status: { in: ["PENDING", "UNDER_REVIEW"] },
        loan: { is: null },
      },
      select: {
        id: true,
        applicantUserId: true,
        companyId: true,
        status: true,
      },
    }),
    prisma.altaCardApplication.findMany({
      where: {
        status: { in: [...BLOCKING_ALTA_CARD_APPLICATION_STATUSES] },
        acceptedAt: null,
        card: { is: null },
      },
      select: {
        id: true,
        applicantUserId: true,
        companyId: true,
        status: true,
      },
    }),
    prisma.altaCardReviewRequest.findMany({
      where: {
        status: { in: [...ALTA_CARD_REVIEW_ACTIVE_STATUSES] },
      },
      select: {
        id: true,
        applicantUserId: true,
        companyId: true,
        status: true,
      },
    }),
  ]);

  await Promise.all([
    ...loanApplications.map((application) =>
      cancelLoanApplication(actorUserId, application, trimmedReason, threadReason),
    ),
    ...altaCardApplications.map((application) =>
      cancelAltaCardApplication(actorUserId, application, trimmedReason, threadReason),
    ),
    ...altaCardReviews.map((review) => cancelAltaCardReview(actorUserId, review, trimmedReason)),
  ]);

  return {
    loanApplications: loanApplications.length,
    altaCardApplications: altaCardApplications.length,
    altaCardReviews: altaCardReviews.length,
  };
}

async function cancelLoanApplication(
  actorUserId: string,
  application: {
    id: string;
    applicantUserId: string;
    companyId: string | null;
    status: string;
  },
  reason: string,
  threadReason: string,
): Promise<void> {
  await prisma.loanApplication.update({
    where: { id: application.id },
    data: {
      status: "CANCELLED",
      reviewedById: actorUserId,
      reviewedAt: new Date(),
      reviewNote: reason || CREDIT_DESK_CANCELLED_NOTE,
    },
  });

  await closeThreadForApplicationIfOpen(
    actorUserId,
    application.id,
    "Secure Deal Room closed after Credit Desk shutdown.",
    buildLendingApplicationCancelledSystemMessage(reason || CREDIT_DESK_CANCELLED_NOTE),
  );

  await writeAuditLog({
    actorUserId,
    action: "LOAN_APPLICATION_CANCELLED",
    entityType: "LOAN_APPLICATION",
    entityId: application.id,
    targetUserId: application.applicantUserId,
    targetCompanyId: application.companyId ?? undefined,
    description: `Cancelled loan application ${application.id.slice(0, 8)} (Credit Desk closed)`,
    metadata: {
      previousStatus: application.status.toLowerCase(),
      reason: threadReason,
      source: "credit_desk_close",
    },
  });

  const { recordRelationshipTimelineEvent } = await import("@/server/relationship-timeline.service");
  await recordRelationshipTimelineEvent({
    userId: application.applicantUserId,
    eventType: "LOAN_DENIED",
    title: "Lending application cancelled",
    occurredAt: new Date(),
    relatedEntityType: "LOAN_APPLICATION",
    relatedEntityId: application.id,
    actorUserId,
  });
}

async function cancelAltaCardApplication(
  actorUserId: string,
  application: {
    id: string;
    applicantUserId: string;
    companyId: string | null;
    status: string;
  },
  reason: string,
  threadReason: string,
): Promise<void> {
  await prisma.altaCardApplication.update({
    where: { id: application.id },
    data: {
      status: "CANCELLED",
      reviewedById: actorUserId,
      reviewedAt: new Date(),
      reviewNote: reason || CREDIT_DESK_CANCELLED_NOTE,
    },
  });

  await postAltaCardApplicationSystemMessage(
    application.id,
    buildAltaCardApplicationCancelledSystemMessage(reason || CREDIT_DESK_CANCELLED_NOTE),
    true,
  );

  await writeAuditLog({
    actorUserId,
    action: "ALTA_CARD_APPLICATION_STATUS_CHANGED",
    entityType: "ALTA_CARD_APPLICATION",
    entityId: application.id,
    targetUserId: application.applicantUserId,
    targetCompanyId: application.companyId ?? undefined,
    description: "Alta Card application cancelled (Credit Desk closed)",
    metadata: {
      previousStatus: application.status.toLowerCase(),
      newStatus: "cancelled",
      reason: threadReason,
      source: "credit_desk_close",
    },
  });
}

async function cancelAltaCardReview(
  actorUserId: string,
  review: {
    id: string;
    applicantUserId: string;
    companyId: string | null;
    status: string;
  },
  reason: string,
): Promise<void> {
  const decisionNote = reason || CREDIT_DESK_CANCELLED_NOTE;

  await prisma.altaCardReviewRequest.update({
    where: { id: review.id },
    data: {
      status: "CANCELLED",
      decisionNote,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await finalizeReviewThreadDecision(
    actorUserId,
    review.id,
    formatReviewCancelledThreadMessage(decisionNote),
  );

  await writeAuditLog({
    actorUserId,
    action: "ALTA_CARD_REVIEW_CANCELLED",
    entityType: "ALTA_CARD_REVIEW",
    entityId: review.id,
    targetUserId: review.applicantUserId,
    targetCompanyId: review.companyId ?? undefined,
    description: "Account review cancelled (Credit Desk closed)",
    metadata: {
      previousStatus: review.status.toLowerCase(),
      reason: decisionNote,
      source: "credit_desk_close",
    },
  });
}
