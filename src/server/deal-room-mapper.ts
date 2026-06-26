import type {
  DealRoomMessageType as DbDealRoomMessageType,
  DealRoomOfferStatus as DbOfferStatus,
  DealRoomOfferType as DbOfferType,
  Prisma,
} from "@prisma/client";
import type { LoanProductType as DbLoanProductType } from "@prisma/client";
import type { DealRoom } from "@/lib/bank/deal-rooms-mock";
import {
  DEAL_ROOM_NEXT_ACTION,
  DEAL_ROOM_STATUS_FROM_DB,
  type DealRoomListRow,
  type DealRoomMessageRow,
  type DealRoomMessageTypeCode,
  type DealRoomOfferRow,
  type DealRoomOfferStatusCode,
  type DealRoomOfferTypeCode,
} from "@/lib/bank/deal-room-types";
import { LOAN_PRODUCT_LABELS, type LoanProductTypeCode } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export const dealRoomInclude = {
  loanApplication: {
    select: {
      id: true,
      productType: true,
      requestedAmount: true,
      termMonths: true,
      purpose: true,
      repaymentPlan: true,
      collateralDescription: true,
    },
  },
  borrowerUser: {
    select: { id: true, discordUsername: true },
  },
  company: {
    select: { id: true, name: true },
  },
  assignedOfficer: {
    select: { id: true, discordUsername: true },
  },
  participants: {
    include: {
      user: { select: { id: true, discordUsername: true } },
    },
  },
} satisfies Prisma.DealRoomInclude;

export type DealRoomRecord = Prisma.DealRoomGetPayload<{ include: typeof dealRoomInclude }>;

export const dealRoomMessageInclude = {
  sender: { select: { id: true, discordUsername: true } },
} satisfies Prisma.DealRoomMessageInclude;

export type DealRoomMessageRecord = Prisma.DealRoomMessageGetPayload<{
  include: typeof dealRoomMessageInclude;
}>;

export const dealRoomOfferInclude = {
  createdBy: { select: { id: true, discordUsername: true } },
} satisfies Prisma.DealRoomOfferInclude;

export type DealRoomOfferRecord = Prisma.DealRoomOfferGetPayload<{
  include: typeof dealRoomOfferInclude;
}>;

const OFFER_TYPE_FROM_DB: Record<DbOfferType, DealRoomOfferTypeCode> = {
  APPLICANT_COUNTER: "applicant_counter",
  OFFICER_OFFER: "officer_offer",
  SYSTEM_GENERATED: "system_generated",
};

const OFFER_TYPE_LABELS: Record<DealRoomOfferTypeCode, string> = {
  applicant_counter: "Counter-Offer",
  officer_offer: "Term Offer",
  system_generated: "System Terms",
};

const OFFER_STATUS_FROM_DB: Record<DbOfferStatus, DealRoomOfferStatusCode> = {
  DRAFT: "draft",
  SENT: "sent",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  WITHDRAWN: "withdrawn",
  EXPIRED: "expired",
};

const OFFER_STATUS_LABELS: Record<DealRoomOfferStatusCode, string> = {
  draft: "Draft",
  sent: "Active",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

const MESSAGE_TYPE_FROM_DB: Record<DbDealRoomMessageType, DealRoomMessageTypeCode> = {
  APPLICANT_MESSAGE: "applicant_message",
  OFFICER_MESSAGE: "officer_message",
  SYSTEM_UPDATE: "system_update",
  INTERNAL_NOTE: "internal_note",
};

const PRODUCT_TYPE_FROM_DB: Record<DbLoanProductType, LoanProductTypeCode> = {
  PERSONAL_CREDIT_LINE: "personal_credit_line",
  BUSINESS_CREDIT_LINE: "business_credit_line",
  PRIVATE_LIQUIDITY_LINE: "private_liquidity_line",
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function loanProductLabel(room: DealRoomRecord): string {
  const productType = room.loanApplication?.productType;
  if (!productType) return "Credit Facility";
  const code = PRODUCT_TYPE_FROM_DB[productType];
  return LOAN_PRODUCT_LABELS[code] ?? "Credit Facility";
}

function officerInitials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.replace(/[._]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function shellContractStatus(status: DealRoomListRow["status"]) {
  if (status === "contract_drafting") return "drafting" as const;
  if (status === "ready_for_signature" || status === "accepted") return "awaiting_acceptance" as const;
  if (status === "approved") return "finalized" as const;
  return "drafting" as const;
}

export function mapDealRoomMessage(message: DealRoomMessageRecord): DealRoomMessageRow {
  return {
    id: message.id,
    dealRoomId: message.dealRoomId,
    messageType: MESSAGE_TYPE_FROM_DB[message.messageType],
    body: message.body,
    senderUserId: message.senderUserId,
    senderName: message.sender?.discordUsername ?? null,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    metadata:
      message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
        ? (message.metadata as Record<string, unknown>)
        : null,
  };
}

export function mapDealRoomStatus(
  status: DealRoomRecord["status"],
): DealRoomListRow["status"] {
  return DEAL_ROOM_STATUS_FROM_DB[status];
}

export function mapDealRoomOfferRow(offer: DealRoomOfferRecord): DealRoomOfferRow {
  const offerType = OFFER_TYPE_FROM_DB[offer.offerType];
  const status = OFFER_STATUS_FROM_DB[offer.status];
  const isExpired =
    offer.status === "EXPIRED" || (offer.expiresAt != null && offer.expiresAt <= new Date());

  return {
    id: offer.id,
    dealRoomId: offer.dealRoomId,
    offerType,
    offerTypeLabel: OFFER_TYPE_LABELS[offerType],
    status: isExpired && offer.status === "SENT" ? "expired" : status,
    statusLabel:
      isExpired && offer.status === "SENT" ? "Expired" : OFFER_STATUS_LABELS[status],
    createdByUserId: offer.createdByUserId,
    createdByName: offer.createdBy.discordUsername,
    proposedPrincipal: decimalToNumber(offer.proposedPrincipal),
    proposedInterestRate: decimalToNumber(offer.proposedInterestRate),
    proposedTermMonths: offer.proposedTermMonths,
    proposedMinimumPayment:
      offer.proposedMinimumPayment != null ? decimalToNumber(offer.proposedMinimumPayment) : null,
    proposedPaymentFrequency: offer.proposedPaymentFrequency,
    collateralDescription: offer.collateralDescription,
    specialConditions: offer.specialConditions,
    rejectionNote: offer.rejectionNote,
    expiresAt: offer.expiresAt?.toISOString() ?? null,
    acceptedAt: offer.acceptedAt?.toISOString() ?? null,
    rejectedAt: offer.rejectedAt?.toISOString() ?? null,
    withdrawnAt: offer.withdrawnAt?.toISOString() ?? null,
    createdAt: offer.createdAt.toISOString(),
    isActive: offer.status === "SENT" && !isExpired,
    canAccept: false,
    canReject: false,
    canWithdraw: false,
  };
}

export function mapDealRoomListRow(room: DealRoomRecord): DealRoomListRow {
  const status = mapDealRoomStatus(room.status);
  const requestedAmount = decimalToNumber(room.currentRequestedAmount);
  const proposedAmount = decimalToNumber(room.currentProposedAmount ?? room.currentRequestedAmount);
  const proposedRate = decimalToNumber(room.currentProposedRate);

  return {
    id: room.id,
    loanApplicationId: room.loanApplicationId,
    loanProduct: loanProductLabel(room),
    applicant: room.borrowerUser.discordUsername,
    applicantHandle: room.borrowerUser.discordUsername,
    company: room.company?.name ?? null,
    assignedOfficer: room.assignedOfficer?.discordUsername ?? null,
    assignedOfficerId: room.assignedOfficerId,
    requestedAmount,
    proposedAmount,
    proposedRate,
    status,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
    lastActivityAt: room.updatedAt.toISOString(),
    lastActivityLabel: formatActivityDateTime(room.updatedAt),
  };
}

export function mapDealRoomDetail(room: DealRoomRecord): DealRoom {
  const list = mapDealRoomListRow(room);
  const termMonths =
    room.currentProposedTermMonths ?? room.loanApplication?.termMonths ?? 12;
  const proposedAmount = list.proposedAmount;
  const proposedRate = list.proposedRate;
  const collateral =
    room.acceptedCollateralDescription?.trim() ||
    room.loanApplication?.collateralDescription?.trim();
  const acceptedPrincipal = room.acceptedPrincipal != null ? decimalToNumber(room.acceptedPrincipal) : null;
  const termSheetAmount = acceptedPrincipal ?? proposedAmount;
  const termSheetRate =
    room.acceptedInterestRate != null ? decimalToNumber(room.acceptedInterestRate) : proposedRate;
  const termSheetMonths = room.acceptedTermMonths ?? termMonths;
  const minPayment =
    room.acceptedMinimumPayment != null
      ? decimalToNumber(room.acceptedMinimumPayment)
      : Math.round(termSheetAmount / Math.max(termSheetMonths, 1));

  return {
    id: list.id,
    loanProduct: list.loanProduct,
    applicant: list.applicant,
    applicantHandle: list.applicantHandle,
    company: list.company,
    assignedOfficer: list.assignedOfficer ?? "Unassigned",
    officerTitle: list.assignedOfficer ? "Loan Officer · Alta Bank" : undefined,
    officerInitials: officerInitials(list.assignedOfficer),
    requestedAmount: list.requestedAmount,
    proposedAmount,
    proposedRate,
    status: list.status,
    nextAction: DEAL_ROOM_NEXT_ACTION[list.status],
    createdAt: list.createdAt,
    lastActivityAt: list.lastActivityAt,
    lastActivityLabel: list.lastActivityLabel,
    requested: {
      amount: list.requestedAmount,
      rate: proposedRate,
      termMonths,
      paymentStructure: room.loanApplication?.repaymentPlan ?? "Monthly",
    },
    termSheet: {
      approvedAmount: termSheetAmount,
      interestRate: termSheetRate,
      repaymentMonths: termSheetMonths,
      minimumPayment: minPayment,
      collateralNotes: collateral
        ? collateral
        : "Collateral terms to be confirmed during underwriting.",
      specialConditions:
        room.acceptedSpecialConditions?.trim() ||
        "Subject to Alta Bank credit approval and standard facility covenants.",
      effectiveDate: (room.acceptedAt ?? room.updatedAt).toISOString().slice(0, 10),
      version: room.acceptedOfferId ? 2 : 1,
    },
    contractStatus: shellContractStatus(list.status),
    activity: [],
    messages: [],
  };
}
