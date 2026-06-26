import { randomUUID } from "node:crypto";
import type {
  DealRoomAgreementDraftStatus,
  DealRoomAgreementSignatureParty,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessInternal,
  canNegotiateCompanyDealRoom,
  canViewCompanyDealRoom,
  isAdmin,
  isOperator,
} from "@/lib/auth/permissions";
import type {
  AgreementDraftRow,
  AgreementFieldData,
  AgreementWorkspaceContext,
  SaveAgreementWorkspaceInput,
  SignAgreementInput,
} from "@/lib/agreements/agreement-types";
import {
  AGREEMENT_REQUIRED_FIELDS,
  buildAgreementChecklist,
  emptyAgreementFieldData,
  suggestAgreementFieldsFromDealRoom,
} from "@/lib/agreements/agreement-types";
import { resolveAgreementTemplateForProduct } from "@/lib/agreements/templates";
import { prisma } from "@/server/db";
import { populateLoanAgreementPdf } from "@/server/agreement-pdf.service";
import { vercelBlobDocumentStorage } from "@/server/document-storage.service";
import { dealRoomInclude, type DealRoomRecord } from "@/server/deal-room-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { writeAuditLog } from "@/server/audit.service";
import { insertDealRoomSystemUpdateInTx } from "@/server/deal-room.service";
import { executeLoanFromExecutedAgreement } from "@/server/deal-room-loan-execution.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function canManageDealRoomOps(user: AltaUser): boolean {
  return isAdmin(user) || isOperator(user);
}

function canViewDealRoom(user: AltaUser, room: Pick<DealRoomRecord, "borrowerUserId" | "companyId">): boolean {
  if (canAccessInternal(user)) return true;
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canViewCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

function canSignAsBorrower(user: AltaUser, room: DealRoomRecord): boolean {
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canNegotiateCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

const agreementInclude = {
  drafts: {
    include: {
      generatedBy: { select: { id: true, discordUsername: true } },
      signatures: {
        include: { user: { select: { id: true, discordUsername: true, discordId: true } } },
      },
    },
    orderBy: { versionNumber: "desc" as const },
  },
  activeDraft: {
    include: {
      generatedBy: { select: { id: true, discordUsername: true } },
      signatures: {
        include: { user: { select: { id: true, discordUsername: true, discordId: true } } },
      },
    },
  },
  executedDraft: {
    include: {
      generatedBy: { select: { id: true, discordUsername: true } },
      signatures: {
        include: { user: { select: { id: true, discordUsername: true, discordId: true } } },
      },
    },
  },
} satisfies Prisma.DealRoomAgreementInclude;

type AgreementRecord = Prisma.DealRoomAgreementGetPayload<{ include: typeof agreementInclude }>;

const DRAFT_STATUS_FROM_DB: Record<DealRoomAgreementDraftStatus, AgreementDraftRow["status"]> = {
  DRAFT: "draft",
  AWAITING_BORROWER: "awaiting_borrower",
  AWAITING_BANK: "awaiting_bank",
  EXECUTED: "executed",
  VOID: "void",
  SUPERSEDED: "superseded",
};

const DRAFT_STATUS_LABELS: Record<AgreementDraftRow["status"], string> = {
  draft: "Draft",
  awaiting_borrower: "Awaiting Borrower",
  awaiting_bank: "Awaiting Alta Bank",
  executed: "Executed",
  void: "Void",
  superseded: "Superseded",
};

function parseFieldData(raw: unknown): AgreementFieldData {
  if (!raw || typeof raw !== "object") return emptyAgreementFieldData();
  return { ...emptyAgreementFieldData(), ...(raw as AgreementFieldData) };
}

function allRequiredComplete(fields: AgreementFieldData): boolean {
  return AGREEMENT_REQUIRED_FIELDS.every((key) => Boolean(fields[key]?.trim()));
}

async function getDealRoomRecord(dealRoomId: string): Promise<DealRoomRecord> {
  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: dealRoomInclude,
  });
  if (!room) notFound();
  return room;
}

async function assertCanViewDealRoom(userId: string, dealRoomId: string) {
  const [user, room] = await Promise.all([getAltaUser(userId), getDealRoomRecord(dealRoomId)]);
  if (!canViewDealRoom(user, room)) forbidden();
  return { user, room };
}

async function getOrCreateAgreement(dealRoom: DealRoomRecord): Promise<AgreementRecord> {
  const existing = await prisma.dealRoomAgreement.findUnique({
    where: { dealRoomId: dealRoom.id },
    include: agreementInclude,
  });
  if (existing) return existing;

  const productType = dealRoom.loanApplication?.productType ?? "PERSONAL_CREDIT_LINE";
  const template = resolveAgreementTemplateForProduct(productType);
  const suggested = suggestAgreementFieldsFromDealRoom({
    borrowerName: dealRoom.borrowerUser.discordUsername,
    companyName: dealRoom.company?.name ?? null,
    acceptedPrincipal: dealRoom.acceptedPrincipal ? Number(dealRoom.acceptedPrincipal) : null,
    acceptedInterestRate: dealRoom.acceptedInterestRate ? Number(dealRoom.acceptedInterestRate) : null,
    acceptedTermMonths: dealRoom.acceptedTermMonths,
    acceptedCollateralDescription: dealRoom.acceptedCollateralDescription,
    acceptedSpecialConditions: dealRoom.acceptedSpecialConditions,
    acceptedPaymentFrequency: dealRoom.acceptedPaymentFrequency,
    loanApplicationId: dealRoom.loanApplicationId,
    assignedOfficerName: dealRoom.assignedOfficer?.discordUsername ?? null,
  });

  const created = await prisma.dealRoomAgreement.create({
    data: {
      dealRoomId: dealRoom.id,
      templateSlug: template.slug,
      workspaceFieldData: { ...emptyAgreementFieldData(), ...suggested },
    },
    include: agreementInclude,
  });

  return created;
}

function mapDraftRow(
  draft: NonNullable<AgreementRecord["drafts"]>[number],
  user: AltaUser,
  room: DealRoomRecord,
): AgreementDraftRow {
  const status = DRAFT_STATUS_FROM_DB[draft.status];
  const isOps = canManageDealRoomOps(user);
  const canBorrowerSign =
    status === "awaiting_borrower" && canSignAsBorrower(user, room) && draft.signatures.length === 0;
  const hasBorrowerSig = draft.signatures.some((s) => s.party === "BORROWER");
  const canBankSign = status === "awaiting_bank" && isOps && hasBorrowerSig;

  return {
    id: draft.id,
    versionNumber: draft.versionNumber,
    status,
    statusLabel: DRAFT_STATUS_LABELS[status],
    pdfSha256: draft.pdfSha256,
    generatedByName: draft.generatedBy?.discordUsername ?? null,
    generatedAt: draft.generatedAt?.toISOString() ?? null,
    voidedAt: draft.voidedAt?.toISOString() ?? null,
    executedAt: draft.executedAt?.toISOString() ?? null,
    downloadUrl: draft.pdfStorageKey ? `/api/deal-rooms/agreement-drafts/${draft.id}/download` : null,
    signatures: draft.signatures.map((s) => ({
      party: s.party === "BORROWER" ? "borrower" : "bank",
      userId: s.userId,
      userName: s.user.discordUsername,
      signatureName: s.signatureName,
      discordId: s.discordId,
      signedAt: s.signedAt.toISOString(),
      ipAddress: s.ipAddress,
    })),
    canSignBorrower: canBorrowerSign,
    canSignBank: canBankSign,
    canVoid: isOps && (status === "draft" || status === "awaiting_borrower" || status === "awaiting_bank"),
    isReadOnly: status === "executed" || status === "void" || status === "superseded",
  };
}

function buildExecutionChecklist(input: {
  termsAccepted: boolean;
  documentsUploaded: boolean;
  documentsReviewed: boolean;
  agreementPrepared: boolean;
  draftGenerated: boolean;
  borrowerSigned: boolean;
  bankSigned: boolean;
  loanCreated: boolean;
  fundsDisbursed: boolean;
}): AgreementWorkspaceContext["executionChecklist"] {
  return [
    { key: "terms", label: "Terms Accepted", complete: input.termsAccepted },
    { key: "docs_uploaded", label: "Required Documents Uploaded", complete: input.documentsUploaded },
    { key: "docs_reviewed", label: "Documents Reviewed", complete: input.documentsReviewed },
    { key: "prepared", label: "Agreement Prepared", complete: input.agreementPrepared },
    { key: "generated", label: "Draft Generated", complete: input.draftGenerated },
    { key: "borrower_signed", label: "Borrower Signed", complete: input.borrowerSigned },
    { key: "bank_signed", label: "Alta Bank Signed", complete: input.bankSigned },
    { key: "loan_created", label: "Loan Created", complete: input.loanCreated },
    { key: "disbursed", label: "Funds Disbursed", complete: input.fundsDisbursed },
  ];
}

export async function getAgreementWorkspace(
  actorUserId: string,
  dealRoomId: string,
): Promise<AgreementWorkspaceContext> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, dealRoomId);
  const agreement = await getOrCreateAgreement(room);
  const fieldData = parseFieldData(agreement.workspaceFieldData);
  const isOps = canManageDealRoomOps(user);

  const activeDraft = agreement.activeDraft
    ? mapDraftRow(agreement.activeDraft, user, room)
    : null;
  const executedDraft = agreement.executedDraft
    ? mapDraftRow(agreement.executedDraft, user, room)
    : null;

  const docStats = await prisma.dealRoomDocument.groupBy({
    by: ["status"],
    where: { dealRoomId, visibility: "SHARED" },
    _count: true,
  });
  const activeDocs = docStats.find((d) => d.status === "ACTIVE")?._count ?? 0;
  const approvedRequests = await prisma.dealRoomDocumentRequest.count({
    where: { dealRoomId, status: "APPROVED" },
  });

  const workspaceLocked = Boolean(
    activeDraft && !["void", "superseded"].includes(activeDraft.status),
  );

  const template = resolveAgreementTemplateForProduct(
    room.loanApplication?.productType ?? "PERSONAL_CREDIT_LINE",
  );

  return {
    dealRoomId,
    templateSlug: agreement.templateSlug,
    templateLabel: template.label,
    workspaceLocked: workspaceLocked && isOps,
    fieldData,
    checklist: buildAgreementChecklist(fieldData),
    allRequiredComplete: allRequiredComplete(fieldData),
    activeDraft,
    draftHistory: agreement.drafts.map((d) => mapDraftRow(d, user, room)),
    executedDraft,
    executionChecklist: buildExecutionChecklist({
      termsAccepted: Boolean(room.acceptedAt),
      documentsUploaded: activeDocs > 0,
      documentsReviewed: approvedRequests > 0,
      agreementPrepared: allRequiredComplete(fieldData),
      draftGenerated: Boolean(activeDraft),
      borrowerSigned: activeDraft?.signatures.some((s) => s.party === "borrower") ?? false,
      bankSigned: activeDraft?.signatures.some((s) => s.party === "bank") ?? false,
      loanCreated: Boolean(room.executedLoanId),
      fundsDisbursed: room.status === "EXECUTED",
    }),
    canEditWorkspace: isOps && !workspaceLocked && room.status !== "EXECUTED",
    canGenerate: isOps && allRequiredComplete(fieldData) && !workspaceLocked,
    canCreateNewDraft: isOps && workspaceLocked && activeDraft?.status !== "executed",
    previewUrl: `/api/deal-rooms/${dealRoomId}/agreement/preview`,
  };
}

export async function saveAgreementWorkspace(
  actorUserId: string,
  input: SaveAgreementWorkspaceInput,
): Promise<AgreementWorkspaceContext> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, input.dealRoomId);
  if (!canManageDealRoomOps(user)) forbidden();
  if (room.status === "EXECUTED") badRequest("Executed agreements cannot be edited.");

  const agreement = await getOrCreateAgreement(room);
  const active = agreement.activeDraft;
  if (
    active &&
    !["VOID", "SUPERSEDED"].includes(active.status) &&
    active.status !== "EXECUTED"
  ) {
    badRequest("Agreement workspace is locked. Void the current draft or create a new draft.");
  }

  await prisma.dealRoomAgreement.update({
    where: { id: agreement.id },
    data: { workspaceFieldData: input.fieldData },
  });

  return getAgreementWorkspace(actorUserId, input.dealRoomId);
}

async function storeAgreementPdf(
  dealRoomId: string,
  versionNumber: number,
  bytes: Uint8Array,
): Promise<string> {
  const pathname = `deal-room-agreements/${dealRoomId}/draft-v${versionNumber}-${randomUUID().slice(0, 8)}.pdf`;
  const stored = await vercelBlobDocumentStorage.upload(pathname, Buffer.from(bytes), "application/pdf");
  return stored.pathname;
}

export async function generateAgreementDraft(
  actorUserId: string,
  dealRoomId: string,
): Promise<AgreementWorkspaceContext> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, dealRoomId);
  if (!canManageDealRoomOps(user)) forbidden();

  const agreement = await getOrCreateAgreement(room);
  const fieldData = parseFieldData(agreement.workspaceFieldData);
  if (!allRequiredComplete(fieldData)) badRequest("Complete all required agreement fields first.");

  const nextVersion =
    (await prisma.dealRoomAgreementDraft.aggregate({
      where: { agreementId: agreement.id },
      _max: { versionNumber: true },
    }))._max.versionNumber ?? 0;

  const versionNumber = nextVersion + 1;
  const { bytes, sha256 } = await populateLoanAgreementPdf(agreement.templateSlug, fieldData);
  const storageKey = await storeAgreementPdf(dealRoomId, versionNumber, bytes);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (agreement.activeDraftId) {
      await tx.dealRoomAgreementDraft.update({
        where: { id: agreement.activeDraftId },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
    }

    const draft = await tx.dealRoomAgreementDraft.create({
      data: {
        agreementId: agreement.id,
        versionNumber,
        status: "AWAITING_BORROWER",
        fieldData,
        pdfStorageKey: storageKey,
        pdfSha256: sha256,
        generatedByUserId: actorUserId,
        generatedAt: now,
      },
    });

    await tx.dealRoomAgreement.update({
      where: { id: agreement.id },
      data: { activeDraftId: draft.id },
    });

    await tx.dealRoom.update({
      where: { id: dealRoomId },
      data: { status: "READY_FOR_ACCEPTANCE", updatedAt: now },
    });

    await insertDealRoomSystemUpdateInTx(
      tx,
      dealRoomId,
      `Alta Bank generated Agreement Draft V${versionNumber}.`,
      { metadata: { draftId: draft.id, versionNumber }, actorUserId },
    );
  });

  await writeAuditLog({
    actorUserId,
    action: versionNumber === 1 ? "DEAL_ROOM_AGREEMENT_GENERATED" : "DEAL_ROOM_AGREEMENT_REGENERATED",
    entityType: "DEAL_ROOM",
    entityId: dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Agreement draft V${versionNumber} generated for deal room ${dealRoomId}.`,
    metadata: { dealRoomId, version: versionNumber },
  });

  const { touchSlaMilestone, notifyDealRoomStakeholders } = await import("@/server/deal-room-ops.service");
  await touchSlaMilestone(dealRoomId, "slaAgreementGeneratedAt");
  await notifyDealRoomStakeholders(
    dealRoomId,
    "DEAL_ROOM_AGREEMENT_READY",
    "Agreement ready for review",
    `Agreement draft V${versionNumber} is ready for your review.`,
    `/bank/lending/deal-rooms/${dealRoomId}`,
  );

  return getAgreementWorkspace(actorUserId, dealRoomId);
}

export async function prepareNewAgreementDraftVersion(
  actorUserId: string,
  dealRoomId: string,
): Promise<AgreementWorkspaceContext> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, dealRoomId);
  if (!canManageDealRoomOps(user)) forbidden();
  if (room.status === "EXECUTED") badRequest("Executed agreements cannot be amended.");

  const agreement = await getOrCreateAgreement(room);
  if (!agreement.activeDraftId) {
    return getAgreementWorkspace(actorUserId, dealRoomId);
  }

  const active = await prisma.dealRoomAgreementDraft.findUnique({
    where: { id: agreement.activeDraftId },
  });
  if (!active || active.status === "EXECUTED") {
    badRequest("No unsigned draft to replace.");
  }

  return voidAgreementDraft(actorUserId, active.id);
}

export async function voidAgreementDraft(
  actorUserId: string,
  draftId: string,
): Promise<AgreementWorkspaceContext> {
  const draft = await prisma.dealRoomAgreementDraft.findUnique({
    where: { id: draftId },
    include: { agreement: true },
  });
  if (!draft) notFound();
  if (draft.status === "EXECUTED") badRequest("Executed agreements cannot be voided.");

  const user = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(user)) forbidden();

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.dealRoomAgreementDraft.update({
      where: { id: draftId },
      data: { status: "VOID", voidedAt: now, voidedByUserId: actorUserId },
    });
    if (draft.agreement.activeDraftId === draftId) {
      await tx.dealRoomAgreement.update({
        where: { id: draft.agreementId },
        data: { activeDraftId: null },
      });
    }
    await insertDealRoomSystemUpdateInTx(tx, draft.agreement.dealRoomId, "Agreement draft voided.", {
      metadata: { draftId },
      actorUserId,
    });
  });

  return getAgreementWorkspace(actorUserId, draft.agreement.dealRoomId);
}

async function signAgreementParty(
  actorUserId: string,
  input: SignAgreementInput,
  party: DealRoomAgreementSignatureParty,
  ipAddress: string | null,
): Promise<AgreementWorkspaceContext> {
  if (!input.confirmed) badRequest("You must confirm acceptance before signing.");
  if (!input.signatureName.trim()) badRequest("Typed legal name is required.");

  const draft = await prisma.dealRoomAgreementDraft.findUnique({
    where: { id: input.draftId },
    include: {
      agreement: { include: { dealRoom: { include: dealRoomInclude } } },
      signatures: true,
    },
  });
  if (!draft) notFound();

  const room = draft.agreement.dealRoom;
  const { user } = await assertCanViewDealRoom(actorUserId, room.id);

  if (party === "BORROWER") {
    if (draft.status !== "AWAITING_BORROWER") badRequest("This draft is not awaiting borrower signature.");
    if (!canSignAsBorrower(user, room)) forbidden();
    if (draft.signatures.some((s) => s.party === "BORROWER")) {
      badRequest("Borrower has already signed this draft.");
    }
  } else {
    if (draft.status !== "AWAITING_BANK") badRequest("This draft is not awaiting Alta Bank signature.");
    if (!canManageDealRoomOps(user)) forbidden();
    if (draft.signatures.some((s) => s.party === "BANK")) {
      badRequest("Alta Bank has already signed this draft.");
    }
  }

  const dbUser = await prisma.user.findUnique({ where: { id: actorUserId } });
  const now = new Date();

  if (party === "BORROWER") {
    await prisma.dealRoomAgreementSignature.create({
      data: {
        draftId: draft.id,
        party,
        userId: actorUserId,
        signatureName: input.signatureName.trim(),
        discordId: dbUser?.discordId ?? null,
        ipAddress,
      },
    });
  }

  if (party === "BORROWER") {
    await prisma.$transaction(async (tx) => {
      await tx.dealRoomAgreementDraft.update({
        where: { id: draft.id },
        data: { status: "AWAITING_BANK" },
      });
      await insertDealRoomSystemUpdateInTx(tx, room.id, "Borrower signed agreement.", {
        metadata: { draftId: draft.id },
        actorUserId,
      });
    });

    await writeAuditLog({
      actorUserId,
      action: "DEAL_ROOM_AGREEMENT_BORROWER_SIGNED",
      entityType: "DEAL_ROOM",
      entityId: room.id,
      targetUserId: room.borrowerUserId,
      metadata: { dealRoomId: room.id, agreementId: draft.agreementId, version: draft.versionNumber },
    });

    const { touchSlaMilestone, notifyDealRoomStakeholders } = await import("@/server/deal-room-ops.service");
    await touchSlaMilestone(room.id, "slaBorrowerSignedAt");
    await notifyDealRoomStakeholders(
      room.id,
      "DEAL_ROOM_BORROWER_SIGNED",
      "Borrower signed agreement",
      "The borrower has digitally accepted the loan agreement.",
      `/internal/lending/deal-rooms/${room.id}`,
    );

    return getAgreementWorkspace(actorUserId, room.id);
  }

  const fieldData = parseFieldData(draft.fieldData);
  const borrowerSig = await prisma.dealRoomAgreementSignature.findUnique({
    where: { draftId_party: { draftId: draft.id, party: "BORROWER" } },
  });

  const { bytes, sha256 } = await populateLoanAgreementPdf(
    draft.agreement.templateSlug,
    fieldData,
    {
      borrowerName: borrowerSig?.signatureName,
      borrowerSignedAt: borrowerSig?.signedAt.toISOString().slice(0, 10),
      bankOfficerName: input.signatureName.trim(),
      bankSignedAt: now.toISOString().slice(0, 10),
    },
  );
  const executedStorageKey = await storeAgreementPdf(room.id, draft.versionNumber, bytes);

  await executeLoanFromExecutedAgreement({
    actorUserId,
    dealRoomId: room.id,
    agreementId: draft.agreementId,
    draftId: draft.id,
    draftVersion: draft.versionNumber,
    templateSlug: draft.agreement.templateSlug,
    fieldData,
    executedPdf: {
      storageKey: executedStorageKey,
      sha256,
      fileSizeBytes: bytes.length,
    },
    bankSignatureName: input.signatureName.trim(),
    bankSignatureDiscordId: dbUser?.discordId ?? null,
    bankSignatureIp: ipAddress,
  });

  return getAgreementWorkspace(actorUserId, room.id);
}

export async function signAgreementAsBorrower(
  actorUserId: string,
  input: SignAgreementInput,
  ipAddress: string | null,
): Promise<AgreementWorkspaceContext> {
  return signAgreementParty(actorUserId, input, "BORROWER", ipAddress);
}

export async function signAgreementAsBank(
  actorUserId: string,
  input: SignAgreementInput,
  ipAddress: string | null,
): Promise<AgreementWorkspaceContext> {
  return signAgreementParty(actorUserId, input, "BANK", ipAddress);
}

export async function getAgreementDraftForDownload(actorUserId: string, draftId: string) {
  const draft = await prisma.dealRoomAgreementDraft.findUnique({
    where: { id: draftId },
    include: { agreement: { include: { dealRoom: true } } },
  });
  if (!draft?.pdfStorageKey) notFound();
  await assertCanViewDealRoom(actorUserId, draft.agreement.dealRoomId);
  return draft;
}
