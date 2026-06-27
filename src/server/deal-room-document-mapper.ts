import type {
  DealRoomDocumentRequestStatus as DbRequestStatus,
  DealRoomDocumentStatus as DbDocStatus,
  DealRoomDocumentType as DbDocType,
  DealRoomDocumentVisibility as DbVisibility,
  Prisma,
} from "@prisma/client";
import type {
  DealRoomDocumentApplicantStatusCode,
  DealRoomDocumentRequestStatusCode,
  DealRoomDocumentRow,
  DealRoomDocumentRequestRow,
  DealRoomDocumentStatusCode,
  DealRoomDocumentTypeCode,
  DealRoomDocumentVisibilityCode,
  DealRoomDocumentsContext,
} from "@/lib/bank/deal-room-types";
import { DEAL_ROOM_CHECKLIST_TEMPLATE, DEAL_ROOM_DOCUMENT_TYPE_LABELS } from "@/lib/bank/deal-room-types";
import { generateSignedDocumentUrl } from "@/server/document-storage.service";
import { threadAttachmentHref } from "@/lib/bank/thread-attachment-utils";
import { formatActivityDateTime } from "@/lib/format-datetime";

export const dealRoomDocumentInclude = {
  uploadedBy: { select: { id: true, discordUsername: true } },
} satisfies Prisma.DealRoomDocumentInclude;

export type DealRoomDocumentRecord = Prisma.DealRoomDocumentGetPayload<{
  include: typeof dealRoomDocumentInclude;
}>;

export const dealRoomDocumentRequestInclude = {
  requestedBy: { select: { id: true, discordUsername: true } },
  reviewedBy: { select: { id: true, discordUsername: true } },
  linkedDocument: { select: { id: true } },
} satisfies Prisma.DealRoomDocumentRequestInclude;

export type DealRoomDocumentRequestRecord = Prisma.DealRoomDocumentRequestGetPayload<{
  include: typeof dealRoomDocumentRequestInclude;
}>;

const DOC_TYPE_FROM_DB: Record<DbDocType, DealRoomDocumentTypeCode> = {
  IDENTIFICATION: "identification",
  INCOME_VERIFICATION: "income_verification",
  BANK_STATEMENT: "bank_statement",
  TAX_DOCUMENT: "tax_document",
  BUSINESS_FINANCIALS: "business_financials",
  COLLATERAL: "collateral",
  SUPPORTING_DOCUMENT: "supporting_document",
  CONTRACT_DRAFT: "contract_draft",
  SIGNED_CONTRACT: "signed_contract",
  INTERNAL_MEMO: "internal_memo",
  OTHER: "other",
};

export const DOC_TYPE_TO_DB: Record<DealRoomDocumentTypeCode, DbDocType> = {
  identification: "IDENTIFICATION",
  income_verification: "INCOME_VERIFICATION",
  bank_statement: "BANK_STATEMENT",
  tax_document: "TAX_DOCUMENT",
  business_financials: "BUSINESS_FINANCIALS",
  collateral: "COLLATERAL",
  supporting_document: "SUPPORTING_DOCUMENT",
  contract_draft: "CONTRACT_DRAFT",
  signed_contract: "SIGNED_CONTRACT",
  internal_memo: "INTERNAL_MEMO",
  other: "OTHER",
};

export const DOC_TYPE_LABELS = DEAL_ROOM_DOCUMENT_TYPE_LABELS;

const VISIBILITY_FROM_DB: Record<DbVisibility, DealRoomDocumentVisibilityCode> = {
  SHARED: "shared",
  INTERNAL_ONLY: "internal_only",
};

export const VISIBILITY_TO_DB: Record<DealRoomDocumentVisibilityCode, DbVisibility> = {
  shared: "SHARED",
  internal_only: "INTERNAL_ONLY",
};

const DOC_STATUS_FROM_DB: Record<DbDocStatus, DealRoomDocumentStatusCode> = {
  ACTIVE: "active",
  REPLACED: "replaced",
  DELETED: "deleted",
};

const DOC_STATUS_LABELS: Record<DealRoomDocumentStatusCode, string> = {
  active: "Active",
  replaced: "Replaced",
  deleted: "Deleted",
};

const REQUEST_STATUS_FROM_DB: Record<DbRequestStatus, DealRoomDocumentRequestStatusCode> = {
  REQUESTED: "requested",
  RECEIVED: "received",
  REVIEWED: "reviewed",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const REQUEST_STATUS_LABELS: Record<DealRoomDocumentRequestStatusCode, string> = {
  requested: "Requested",
  received: "Received",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
};

const APPLICANT_STATUS_LABELS: Record<DealRoomDocumentApplicantStatusCode, string> = {
  requested: "Requested",
  uploaded: "Uploaded",
  accepted: "Accepted",
  needs_attention: "Needs Attention",
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapApplicantRequestStatus(
  status: DealRoomDocumentRequestStatusCode,
): { code: DealRoomDocumentApplicantStatusCode; label: string } {
  switch (status) {
    case "requested":
      return { code: "requested", label: APPLICANT_STATUS_LABELS.requested };
    case "received":
    case "reviewed":
      return { code: "uploaded", label: APPLICANT_STATUS_LABELS.uploaded };
    case "approved":
      return { code: "accepted", label: APPLICANT_STATUS_LABELS.accepted };
    case "rejected":
      return { code: "needs_attention", label: APPLICANT_STATUS_LABELS.needs_attention };
  }
}

export function mapDealRoomDocumentRow(
  doc: DealRoomDocumentRecord,
  permissions: Pick<DealRoomDocumentRow, "canDownload" | "canReplace" | "canDelete">,
): DealRoomDocumentRow {
  const documentType = DOC_TYPE_FROM_DB[doc.documentType];
  const status = DOC_STATUS_FROM_DB[doc.status];
  return {
    id: doc.id,
    dealRoomId: doc.dealRoomId,
    documentType,
    documentTypeLabel: DOC_TYPE_LABELS[documentType],
    visibility: VISIBILITY_FROM_DB[doc.visibility],
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSizeBytes: doc.fileSizeBytes,
    fileSizeLabel: formatFileSize(doc.fileSizeBytes),
    description: doc.description,
    status,
    statusLabel: DOC_STATUS_LABELS[status],
    uploadedByUserId: doc.uploadedByUserId,
    uploadedByName: doc.uploadedBy.discordUsername,
    createdAt: doc.createdAt.toISOString(),
    downloadUrl: threadAttachmentHref({
      downloadPath: generateSignedDocumentUrl(doc.id),
      mimeType: doc.mimeType,
      fileName: doc.originalFileName,
    }),
    ...permissions,
  };
}

export function mapDealRoomDocumentRequestRow(
  req: DealRoomDocumentRequestRecord,
  canReview: boolean,
  isInternal: boolean,
): DealRoomDocumentRequestRow {
  const documentType = DOC_TYPE_FROM_DB[req.documentType];
  const status = REQUEST_STATUS_FROM_DB[req.status];
  const applicant = mapApplicantRequestStatus(status);
  return {
    id: req.id,
    dealRoomId: req.dealRoomId,
    documentType,
    documentTypeLabel: DOC_TYPE_LABELS[documentType],
    title: req.title ?? DOC_TYPE_LABELS[documentType],
    status,
    statusLabel: isInternal ? REQUEST_STATUS_LABELS[status] : applicant.label,
    applicantStatus: applicant.code,
    applicantStatusLabel: applicant.label,
    requestNote: req.requestNote,
    reviewNote: isInternal ? req.reviewNote : null,
    requestedAt: req.requestedAt.toISOString(),
    reviewedAt: req.reviewedAt?.toISOString() ?? null,
    linkedDocumentId: req.linkedDocumentId,
    canReview,
  };
}

const REQUIRED_TYPES: DealRoomDocumentTypeCode[] = [
  "identification",
  "income_verification",
  "bank_statement",
  "tax_document",
  "business_financials",
  "collateral",
];

const CONTRACT_TYPES: DealRoomDocumentTypeCode[] = ["contract_draft", "signed_contract"];

export function groupDealRoomDocuments(
  documents: DealRoomDocumentRow[],
  includeInternal: boolean,
): DealRoomDocumentsContext["groups"] {
  const active = documents.filter((d) => d.status === "active");

  const required = active.filter((d) => REQUIRED_TYPES.includes(d.documentType) && d.visibility === "shared");
  const supporting = active.filter(
    (d) =>
      (d.documentType === "supporting_document" || d.documentType === "other") &&
      d.visibility === "shared",
  );
  const contract = active.filter((d) => CONTRACT_TYPES.includes(d.documentType) && d.visibility === "shared");
  const internal = includeInternal
    ? active.filter((d) => d.visibility === "internal_only" || d.documentType === "internal_memo")
    : [];

  const groups: DealRoomDocumentsContext["groups"] = [
    { key: "required", title: "Required Documents", documents: required },
    { key: "supporting", title: "Supporting Documents", documents: supporting },
    { key: "contract", title: "Contract Documents", documents: contract },
  ];

  if (includeInternal) {
    groups.push({ key: "internal", title: "Internal Documents", documents: internal });
  }

  return groups;
}

export function buildChecklistRows(
  requests: DealRoomDocumentRequestRecord[],
  canReview: boolean,
  isInternal: boolean,
): DealRoomDocumentRequestRow[] {
  const byType = new Map(requests.map((r) => [r.documentType, r]));

  const rows: DealRoomDocumentRequestRow[] = [];

  for (const template of DEAL_ROOM_CHECKLIST_TEMPLATE) {
    const dbType = DOC_TYPE_TO_DB[template.documentType];
    const existing = byType.get(dbType);
    if (existing) {
      rows.push(mapDealRoomDocumentRequestRow(existing, canReview, isInternal));
      byType.delete(dbType);
    }
  }

  for (const remaining of byType.values()) {
    rows.push(mapDealRoomDocumentRequestRow(remaining, canReview, isInternal));
  }

  return rows.sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime(),
  );
}

export function formatDocumentActivityDate(iso: string): string {
  return formatActivityDateTime(iso);
}
