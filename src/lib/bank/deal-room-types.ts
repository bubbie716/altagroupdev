import type { DealRoomStatus as DbDealRoomStatus } from "@prisma/client";
import type { DealRoomStatus } from "@/lib/bank/deal-rooms-mock";

export type DealRoomStatusCode = DealRoomStatus;

export type DealRoomListRow = {
  id: string;
  loanApplicationId: string | null;
  loanProduct: string;
  applicant: string;
  applicantHandle: string;
  company: string | null;
  assignedOfficer: string | null;
  assignedOfficerId: string | null;
  requestedAmount: number;
  proposedAmount: number;
  proposedRate: number;
  status: DealRoomStatusCode;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  lastActivityLabel: string;
};

export type AssignDealRoomOfficerInput = {
  dealRoomId: string;
  officerUserId: string;
};

export type UpdateDealRoomStatusInput = {
  dealRoomId: string;
  status: DbDealRoomStatus;
};

export type DealRoomMessageTypeCode =
  | "applicant_message"
  | "officer_message"
  | "system_update"
  | "internal_note";

export type DealRoomMessageRow = {
  id: string;
  dealRoomId: string;
  messageType: DealRoomMessageTypeCode;
  body: string;
  senderUserId: string | null;
  senderName: string | null;
  createdAt: string;
  editedAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type SendDealRoomMessageInput = {
  dealRoomId: string;
  body: string;
  /** Internal console only — validated server-side. */
  channel?: "applicant" | "officer" | "internal_note";
};

export type AddDealRoomSystemUpdateInput = {
  dealRoomId: string;
  body: string;
  metadata?: Record<string, unknown>;
  /** When true, may also advance deal room status (e.g. contract drafting). */
  updateStatus?: DbDealRoomStatus;
};

export const DEAL_ROOM_MESSAGE_MAX_LENGTH = 2000;

export const DEAL_ROOM_MESSAGE_SENDER_DELETE_WINDOW_MS = 15 * 60 * 1000;

export const MAX_DEAL_ROOM_TERM_MONTHS = 36;

export type DealRoomOfferTypeCode = "applicant_counter" | "officer_offer" | "system_generated";

export type DealRoomOfferStatusCode =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "expired";

export type DealRoomOfferRow = {
  id: string;
  dealRoomId: string;
  offerType: DealRoomOfferTypeCode;
  offerTypeLabel: string;
  status: DealRoomOfferStatusCode;
  statusLabel: string;
  createdByUserId: string;
  createdByName: string;
  proposedPrincipal: number;
  proposedInterestRate: number;
  proposedTermMonths: number;
  proposedMinimumPayment: number | null;
  proposedPaymentFrequency: string | null;
  collateralDescription: string | null;
  specialConditions: string | null;
  rejectionNote: string | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  isActive: boolean;
  canAccept: boolean;
  canReject: boolean;
  canWithdraw: boolean;
};

export type DealRoomAcceptedTerms = {
  principal: number;
  interestRate: number;
  termMonths: number;
  minimumPayment: number | null;
  paymentFrequency: string | null;
  collateralDescription: string | null;
  specialConditions: string | null;
  acceptedOfferId: string | null;
  acceptedAt: string | null;
};

export type DealRoomTermsContext = {
  requestedAmount: number;
  requestedTermMonths: number;
  requestedPaymentStructure: string | null;
  currentProposedAmount: number | null;
  currentProposedRate: number | null;
  currentProposedTermMonths: number | null;
  acceptedTerms: DealRoomAcceptedTerms | null;
  activeOffer: DealRoomOfferRow | null;
  canCreateCounterOffer: boolean;
  canCreateOfficerOffer: boolean;
};

export type CreateOfficerOfferInput = {
  dealRoomId: string;
  proposedPrincipal: number;
  proposedInterestRate: number;
  proposedTermMonths: number;
  proposedMinimumPayment?: number;
  proposedPaymentFrequency?: string;
  collateralDescription?: string;
  specialConditions?: string;
  expiresAt?: string;
};

export type CreateApplicantCounterOfferInput = {
  dealRoomId: string;
  proposedPrincipal: number;
  proposedInterestRate: number;
  proposedTermMonths: number;
  proposedMinimumPayment?: number;
  proposedPaymentFrequency?: string;
  collateralDescription?: string;
  specialConditions?: string;
};

export type RejectDealRoomOfferInput = {
  offerId: string;
  rejectionNote?: string;
};

export type DealRoomDocumentTypeCode =
  | "identification"
  | "income_verification"
  | "bank_statement"
  | "tax_document"
  | "business_financials"
  | "collateral"
  | "supporting_document"
  | "contract_draft"
  | "signed_contract"
  | "internal_memo"
  | "other";

export type DealRoomDocumentVisibilityCode = "shared" | "internal_only";

export type DealRoomDocumentStatusCode = "active" | "replaced" | "deleted";

export type DealRoomDocumentRequestStatusCode =
  | "requested"
  | "received"
  | "reviewed"
  | "approved"
  | "rejected";

/** Applicant-facing checklist status labels. */
export type DealRoomDocumentApplicantStatusCode =
  | "requested"
  | "uploaded"
  | "accepted"
  | "needs_attention";

export type DealRoomDocumentRow = {
  id: string;
  dealRoomId: string;
  documentType: DealRoomDocumentTypeCode;
  documentTypeLabel: string;
  visibility: DealRoomDocumentVisibilityCode;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  description: string | null;
  status: DealRoomDocumentStatusCode;
  statusLabel: string;
  uploadedByUserId: string;
  uploadedByName: string;
  createdAt: string;
  canDownload: boolean;
  canReplace: boolean;
  canDelete: boolean;
  downloadUrl: string;
};

export type DealRoomDocumentRequestRow = {
  id: string;
  dealRoomId: string;
  documentType: DealRoomDocumentTypeCode;
  documentTypeLabel: string;
  title: string;
  status: DealRoomDocumentRequestStatusCode;
  statusLabel: string;
  applicantStatus: DealRoomDocumentApplicantStatusCode;
  applicantStatusLabel: string;
  requestNote: string | null;
  reviewNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  linkedDocumentId: string | null;
  canReview: boolean;
};

export type DealRoomDocumentGroup = {
  key: "required" | "supporting" | "contract" | "internal";
  title: string;
  documents: DealRoomDocumentRow[];
};

export type DealRoomDocumentsContext = {
  groups: DealRoomDocumentGroup[];
  checklist: DealRoomDocumentRequestRow[];
  canUploadShared: boolean;
  canUploadInternal: boolean;
  totalActive: number;
};

export type UploadDealRoomDocumentInput = {
  dealRoomId: string;
  documentType: DealRoomDocumentTypeCode;
  visibility?: DealRoomDocumentVisibilityCode;
  description?: string;
};

export type RequestDealRoomDocumentInput = {
  dealRoomId: string;
  documentType: DealRoomDocumentTypeCode;
  title?: string;
  requestNote?: string;
};

export type ReviewDealRoomDocumentRequestInput = {
  requestId: string;
  status: "reviewed" | "approved" | "rejected";
  reviewNote?: string;
};

export const DEAL_ROOM_CHECKLIST_TEMPLATE: readonly {
  documentType: DealRoomDocumentTypeCode;
  title: string;
}[] = [
  { documentType: "identification", title: "Government Identification" },
  { documentType: "income_verification", title: "Proof of Income" },
  { documentType: "bank_statement", title: "Bank Statements" },
  { documentType: "business_financials", title: "Business Financials" },
  { documentType: "collateral", title: "Collateral Documentation" },
  { documentType: "supporting_document", title: "Additional Supporting Documents" },
];

export const DEAL_ROOM_DOCUMENT_TYPE_LABELS: Record<DealRoomDocumentTypeCode, string> = {
  identification: "Government Identification",
  income_verification: "Proof of Income",
  bank_statement: "Bank Statements",
  tax_document: "Tax Returns",
  business_financials: "Business Financials",
  collateral: "Collateral Documentation",
  supporting_document: "Supporting Document",
  contract_draft: "Contract Draft",
  signed_contract: "Signed Contract",
  internal_memo: "Internal Memo",
  other: "Other Document",
};

export const DEAL_ROOM_STATUS_FROM_DB: Record<DbDealRoomStatus, DealRoomStatusCode> = {
  UNDER_REVIEW: "under_review",
  NEGOTIATING_TERMS: "negotiating",
  AWAITING_APPLICANT: "awaiting_applicant",
  AWAITING_OFFICER: "awaiting_officer",
  CONTRACT_DRAFTING: "contract_drafting",
  READY_FOR_ACCEPTANCE: "ready_for_signature",
  ACCEPTED: "accepted",
  APPROVED: "approved",
  EXECUTED: "executed",
  DECLINED: "declined",
  CLOSED: "closed",
};

export const DEAL_ROOM_STATUS_TO_DB: Record<DealRoomStatusCode, DbDealRoomStatus> = {
  under_review: "UNDER_REVIEW",
  negotiating: "NEGOTIATING_TERMS",
  awaiting_applicant: "AWAITING_APPLICANT",
  awaiting_officer: "AWAITING_OFFICER",
  contract_drafting: "CONTRACT_DRAFTING",
  ready_for_signature: "READY_FOR_ACCEPTANCE",
  accepted: "ACCEPTED",
  approved: "APPROVED",
  executed: "EXECUTED",
  declined: "DECLINED",
  closed: "CLOSED",
};

export const DEAL_ROOM_NEXT_ACTION: Record<DealRoomStatusCode, string> = {
  under_review: "Officer review in progress",
  negotiating: "Terms under negotiation",
  awaiting_applicant: "Awaiting applicant response",
  awaiting_officer: "Awaiting officer response",
  contract_drafting: "Contract being prepared",
  ready_for_signature: "Ready for acceptance",
  accepted: "Terms accepted — pending approval",
  approved: "Approved — disbursement pending",
  executed: "Loan executed — agreement complete",
  declined: "Facility declined",
  closed: "Deal room closed",
};
