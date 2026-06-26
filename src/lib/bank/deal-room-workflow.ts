import type {
  DealRoomAgreementDraftStatus,
  DealRoomStatus as DbDealRoomStatus,
  DealRoomWorkflowStage as DbWorkflowStage,
} from "@prisma/client";

export type DealRoomWorkflowStageCode =
  | "application_received"
  | "initial_review"
  | "document_collection"
  | "underwriting"
  | "negotiating_terms"
  | "agreement_preparation"
  | "awaiting_borrower_signature"
  | "awaiting_alta_signature"
  | "funding"
  | "completed"
  | "on_hold"
  | "cancelled"
  | "declined"
  | "expired";

export type DealRoomPriorityCode = "low" | "medium" | "high" | "urgent";
export type DealRoomTaskStatusCode = "open" | "in_progress" | "completed" | "cancelled";

export const WORKFLOW_STAGE_FROM_DB: Record<DbWorkflowStage, DealRoomWorkflowStageCode> = {
  APPLICATION_RECEIVED: "application_received",
  INITIAL_REVIEW: "initial_review",
  DOCUMENT_COLLECTION: "document_collection",
  UNDERWRITING: "underwriting",
  NEGOTIATING_TERMS: "negotiating_terms",
  AGREEMENT_PREPARATION: "agreement_preparation",
  AWAITING_BORROWER_SIGNATURE: "awaiting_borrower_signature",
  AWAITING_ALTA_SIGNATURE: "awaiting_alta_signature",
  FUNDING: "funding",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
  DECLINED: "declined",
  EXPIRED: "expired",
};

export const WORKFLOW_STAGE_TO_DB: Record<DealRoomWorkflowStageCode, DbWorkflowStage> = {
  application_received: "APPLICATION_RECEIVED",
  initial_review: "INITIAL_REVIEW",
  document_collection: "DOCUMENT_COLLECTION",
  underwriting: "UNDERWRITING",
  negotiating_terms: "NEGOTIATING_TERMS",
  agreement_preparation: "AGREEMENT_PREPARATION",
  awaiting_borrower_signature: "AWAITING_BORROWER_SIGNATURE",
  awaiting_alta_signature: "AWAITING_ALTA_SIGNATURE",
  funding: "FUNDING",
  completed: "COMPLETED",
  on_hold: "ON_HOLD",
  cancelled: "CANCELLED",
  declined: "DECLINED",
  expired: "EXPIRED",
};

export const WORKFLOW_STAGE_LABELS: Record<DealRoomWorkflowStageCode, string> = {
  application_received: "Application Received",
  initial_review: "Initial Review",
  document_collection: "Document Collection",
  underwriting: "Underwriting",
  negotiating_terms: "Negotiating Terms",
  agreement_preparation: "Agreement Preparation",
  awaiting_borrower_signature: "Awaiting Borrower Signature",
  awaiting_alta_signature: "Awaiting Alta Signature",
  funding: "Funding",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
};

export const WORKFLOW_STAGE_DESCRIPTIONS: Record<DealRoomWorkflowStageCode, string> = {
  application_received: "New facility request received and queued for officer review.",
  initial_review: "Officer is reviewing the application and opening the deal room.",
  document_collection: "Awaiting applicant documents or responses.",
  underwriting: "Alta is reviewing credit, collateral, and facility structure.",
  negotiating_terms: "Active term negotiation between Alta and the applicant.",
  agreement_preparation: "Officer is preparing the loan agreement workspace.",
  awaiting_borrower_signature: "Agreement draft sent — awaiting borrower digital acceptance.",
  awaiting_alta_signature: "Borrower signed — awaiting Alta Bank authorized signature.",
  funding: "Agreement executed — loan funding in progress or pending disbursement.",
  completed: "Loan funded and deal room closed successfully.",
  on_hold: "Deal paused pending internal or external action.",
  cancelled: "Deal room closed without execution.",
  declined: "Facility declined by Alta Bank.",
  expired: "Deal expired due to inactivity or offer expiration.",
};

export const PRIORITY_FROM_DB = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const satisfies Record<string, DealRoomPriorityCode>;

export const PRIORITY_TO_DB = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  urgent: "URGENT",
} as const satisfies Record<DealRoomPriorityCode, string>;

export const TASK_STATUS_FROM_DB = {
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const satisfies Record<string, DealRoomTaskStatusCode>;

/** Derive operational stage from room status and agreement draft state. */
export function deriveWorkflowStage(input: {
  status: DbDealRoomStatus;
  currentStage: DbWorkflowStage;
  activeDraftStatus?: DealRoomAgreementDraftStatus | null;
}): DbWorkflowStage {
  if (input.currentStage === "ON_HOLD") return "ON_HOLD";

  if (input.activeDraftStatus === "AWAITING_BORROWER") return "AWAITING_BORROWER_SIGNATURE";
  if (input.activeDraftStatus === "AWAITING_BANK") return "AWAITING_ALTA_SIGNATURE";

  switch (input.status) {
    case "EXECUTED":
      return "COMPLETED";
    case "DECLINED":
      return "DECLINED";
    case "CLOSED":
      return "CANCELLED";
    case "UNDER_REVIEW":
      return "INITIAL_REVIEW";
    case "NEGOTIATING_TERMS":
      return "NEGOTIATING_TERMS";
    case "AWAITING_APPLICANT":
      return "DOCUMENT_COLLECTION";
    case "AWAITING_OFFICER":
      return "UNDERWRITING";
    case "CONTRACT_DRAFTING":
    case "ACCEPTED":
      return "AGREEMENT_PREPARATION";
    case "READY_FOR_ACCEPTANCE":
      return "AWAITING_BORROWER_SIGNATURE";
    case "APPROVED":
      return "FUNDING";
    default:
      return input.currentStage;
  }
}

export function isWaitingOnBorrower(stage: DbWorkflowStage): boolean {
  return ["DOCUMENT_COLLECTION", "NEGOTIATING_TERMS", "AWAITING_BORROWER_SIGNATURE"].includes(stage);
}

export function isWaitingOnAlta(stage: DbWorkflowStage): boolean {
  return [
    "INITIAL_REVIEW",
    "UNDERWRITING",
    "AGREEMENT_PREPARATION",
    "AWAITING_ALTA_SIGNATURE",
    "FUNDING",
  ].includes(stage);
}

export function isStalled(stageEnteredAt: Date, stage: DbWorkflowStage, now = new Date()): boolean {
  const days = (now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24);
  const thresholds: Partial<Record<DbWorkflowStage, number>> = {
    INITIAL_REVIEW: 3,
    DOCUMENT_COLLECTION: 7,
    UNDERWRITING: 5,
    NEGOTIATING_TERMS: 10,
    AGREEMENT_PREPARATION: 5,
    AWAITING_BORROWER_SIGNATURE: 7,
    AWAITING_ALTA_SIGNATURE: 3,
    FUNDING: 2,
  };
  const limit = thresholds[stage];
  return limit != null && days > limit;
}

export function hoursInStage(stageEnteredAt: Date, now = new Date()): number {
  return Math.round((now.getTime() - stageEnteredAt.getTime()) / (1000 * 60 * 60));
}
