import { randomUUID } from "node:crypto";
import type {
  DealRoomDocumentType as DbDocType,
  DealRoomDocumentVisibility as DbVisibility,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessBankInternal,
  canNegotiateCompanyDealRoom,
  canViewCompanyDealRoom,
  isAdmin,
} from "@/lib/auth/permissions";
import type {
  DealRoomDocumentRow,
  DealRoomDocumentsContext,
  DealRoomDocumentTypeCode,
  DealRoomDocumentVisibilityCode,
  RequestDealRoomDocumentInput,
  ReviewDealRoomDocumentRequestInput,
  UploadDealRoomDocumentInput,
} from "@/lib/bank/deal-room-types";
import type { DealRoomDocumentFileInput } from "@/lib/storage/deal-room-document.constants";
import { prisma } from "@/server/db";
import {
  buildChecklistRows,
  dealRoomDocumentInclude,
  dealRoomDocumentRequestInclude,
  DOC_TYPE_TO_DB,
  groupDealRoomDocuments,
  mapDealRoomDocumentRow,
  VISIBILITY_TO_DB,
} from "@/server/deal-room-document-mapper";
import {
  generateSignedDocumentUrl,
  uploadDealRoomDocument,
} from "@/server/document-storage.service";
import { dealRoomInclude, type DealRoomRecord } from "@/server/deal-room-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { writeAuditLog } from "@/server/audit.service";
import { insertDealRoomSystemUpdateInTx } from "@/server/deal-room.service";

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
  return canAccessBankInternal(user);
}

function canViewDealRoom(user: AltaUser, room: Pick<DealRoomRecord, "borrowerUserId" | "companyId">): boolean {
  if (canAccessBankInternal(user)) return true;
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canViewCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

function canUploadSharedDocuments(user: AltaUser, room: DealRoomRecord): boolean {
  if (canManageDealRoomOps(user)) return true;
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canNegotiateCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

const APPLICANT_BLOCKED_TYPES: DbDocType[] = ["INTERNAL_MEMO", "CONTRACT_DRAFT"];

async function getDealRoomRecord(dealRoomId: string): Promise<DealRoomRecord> {
  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: dealRoomInclude,
  });
  if (!room) notFound();
  return room;
}

async function assertCanViewDealRoom(userId: string, dealRoomId: string): Promise<{
  user: AltaUser;
  room: DealRoomRecord;
}> {
  const [user, room] = await Promise.all([getAltaUser(userId), getDealRoomRecord(dealRoomId)]);
  if (!canViewDealRoom(user, room)) forbidden();
  return { user, room };
}

function documentPermissions(
  user: AltaUser,
  room: DealRoomRecord,
  doc: { uploadedByUserId: string; visibility: DbVisibility; status: string },
): Pick<DealRoomDocumentRow, "canDownload" | "canReplace" | "canDelete"> {
  const isOps = canManageDealRoomOps(user);
  const canUpload = canUploadSharedDocuments(user, room);
  const isOwner = doc.uploadedByUserId === user.id;

  if (doc.visibility === "INTERNAL_ONLY" && !isOps) {
    return { canDownload: false, canReplace: false, canDelete: false };
  }

  const canDownload = doc.status === "ACTIVE";
  const canReplace =
    doc.status === "ACTIVE" && (isOps || (isOwner && canUpload));
  const canDelete = doc.status === "ACTIVE" && (isOps || (isOwner && canUpload));

  return { canDownload, canReplace, canDelete };
}

async function writeDocumentAudit(
  actorUserId: string,
  action: string,
  dealRoomId: string,
  doc: {
    id: string;
    documentType: DbDocType;
    visibility: DbVisibility;
    uploadedByUserId: string;
  },
  room: DealRoomRecord,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "DEAL_ROOM",
    entityId: dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `${action.replaceAll("_", " ").toLowerCase()} in deal room ${dealRoomId}.`,
    metadata: {
      dealRoomId,
      documentId: doc.id,
      documentType: doc.documentType,
      visibility: doc.visibility,
      uploadedBy: doc.uploadedByUserId,
    },
  });
}

async function linkUploadToOpenRequest(
  tx: Prisma.TransactionClient,
  dealRoomId: string,
  documentType: DbDocType,
  documentId: string,
): Promise<void> {
  const openRequest = await tx.dealRoomDocumentRequest.findFirst({
    where: {
      dealRoomId,
      documentType,
      status: { in: ["REQUESTED", "REJECTED"] },
    },
    orderBy: { requestedAt: "desc" },
  });

  if (!openRequest) return;

  await tx.dealRoomDocumentRequest.update({
    where: { id: openRequest.id },
    data: {
      status: "RECEIVED",
      linkedDocumentId: documentId,
      reviewedAt: null,
      reviewedByUserId: null,
      reviewNote: null,
    },
  });
}

function systemMessageForUpload(
  documentType: DbDocType,
  visibility: DbVisibility,
  isOps: boolean,
): string {
  if (documentType === "CONTRACT_DRAFT") return "Officer uploaded contract draft.";
  if (documentType === "INTERNAL_MEMO") return "Internal document added to deal room.";
  if (isOps) return "Alta uploaded a document to the deal room.";
  return "Applicant uploaded document.";
}

export async function getDocuments(
  actorUserId: string,
  dealRoomId: string,
): Promise<DealRoomDocumentsContext> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, dealRoomId);
  const isOps = canManageDealRoomOps(user);

  const [documents, requests] = await Promise.all([
    prisma.dealRoomDocument.findMany({
      where: {
        dealRoomId,
        status: { not: "DELETED" },
        ...(isOps ? {} : { visibility: "SHARED" }),
      },
      include: dealRoomDocumentInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.dealRoomDocumentRequest.findMany({
      where: { dealRoomId },
      include: dealRoomDocumentRequestInclude,
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const mappedDocs = documents.map((doc) =>
    mapDealRoomDocumentRow(doc, documentPermissions(user, room, doc)),
  );

  return {
    groups: groupDealRoomDocuments(mappedDocs, isOps),
    checklist: buildChecklistRows(requests, isOps, isOps),
    canUploadShared: canUploadSharedDocuments(user, room) && room.status !== "EXECUTED",
    canUploadInternal: isOps && room.status !== "EXECUTED",
    totalActive: mappedDocs.filter((d) => d.status === "active").length,
  };
}

export async function uploadDocument(
  actorUserId: string,
  input: UploadDealRoomDocumentInput,
  file: DealRoomDocumentFileInput,
): Promise<DealRoomDocumentRow> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, input.dealRoomId);
  if (room.status === "EXECUTED") {
    badRequest("This deal room has been executed. Documents are read-only.");
  }
  const isOps = canManageDealRoomOps(user);

  const visibility: DealRoomDocumentVisibilityCode = input.visibility ?? "shared";
  if (visibility === "internal_only" && !isOps) forbidden();
  if (!canUploadSharedDocuments(user, room)) forbidden();

  const dbType = DOC_TYPE_TO_DB[input.documentType];
  if (!isOps && APPLICANT_BLOCKED_TYPES.includes(dbType)) {
    badRequest("You cannot upload this document type.");
  }

  const documentId = randomUUID();

  const stored = await uploadDealRoomDocument(file, {
    dealRoomId: input.dealRoomId,
    uploadedByUserId: actorUserId,
    documentId,
  });

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoomDocument.create({
      data: {
        id: documentId,
        dealRoomId: input.dealRoomId,
        uploadedByUserId: actorUserId,
        documentType: dbType,
        visibility: VISIBILITY_TO_DB[visibility],
        originalFileName: file.name,
        storedFileName: stored.storedFileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        description: input.description?.trim() || null,
      },
      include: dealRoomDocumentInclude,
    });

    if (visibility === "shared") {
      await linkUploadToOpenRequest(tx, input.dealRoomId, dbType, created.id);
    }

    await insertDealRoomSystemUpdateInTx(
      tx,
      input.dealRoomId,
      systemMessageForUpload(dbType, VISIBILITY_TO_DB[visibility], isOps),
      {
        metadata: { documentId: created.id, documentType: dbType },
        actorUserId,
      },
    );

    return created;
  });

  await writeDocumentAudit(actorUserId, "DEAL_ROOM_DOCUMENT_UPLOADED", input.dealRoomId, doc, room);

  if (visibility === "shared" && !isOps) {
    const { touchSlaMilestone, notifyDealRoomStakeholders } = await import("@/server/deal-room-ops.service");
    await touchSlaMilestone(input.dealRoomId, "slaDocumentsReceivedAt");
    await notifyDealRoomStakeholders(
      input.dealRoomId,
      "DEAL_ROOM_DOCUMENT_UPLOADED",
      "Document uploaded",
      "The applicant uploaded a document to the deal room.",
      `/internal/lending/deal-rooms/${input.dealRoomId}`,
    );
  } else if (visibility === "shared" && isOps) {
    const { notifyDealRoomStakeholders } = await import("@/server/deal-room-ops.service");
    await notifyDealRoomStakeholders(
      input.dealRoomId,
      "DEAL_ROOM_DOCUMENT_UPLOADED",
      "Document uploaded",
      "Alta Bank uploaded a document to your deal room.",
      `/bank/lending/deal-rooms/${input.dealRoomId}`,
    );
  }

  return mapDealRoomDocumentRow(doc, documentPermissions(user, room, doc));
}

export async function replaceDocument(
  actorUserId: string,
  documentId: string,
  file: DealRoomDocumentFileInput,
  description?: string,
): Promise<DealRoomDocumentRow> {
  const existing = await prisma.dealRoomDocument.findUnique({
    where: { id: documentId },
    include: dealRoomDocumentInclude,
  });
  if (!existing || existing.status !== "ACTIVE") notFound();

  const { user, room } = await assertCanViewDealRoom(actorUserId, existing.dealRoomId);
  const perms = documentPermissions(user, room, existing);
  if (!perms.canReplace) forbidden();

  const isOps = canManageDealRoomOps(user);
  const newId = randomUUID();

  const stored = await uploadDealRoomDocument(file, {
    dealRoomId: existing.dealRoomId,
    uploadedByUserId: actorUserId,
    documentId: newId,
  });

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoomDocument.create({
      data: {
        id: newId,
        dealRoomId: existing.dealRoomId,
        uploadedByUserId: actorUserId,
        documentType: existing.documentType,
        visibility: existing.visibility,
        originalFileName: file.name,
        storedFileName: stored.storedFileName,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        description: description?.trim() || existing.description,
      },
      include: dealRoomDocumentInclude,
    });

    await tx.dealRoomDocument.update({
      where: { id: documentId },
      data: { status: "REPLACED", replacedByDocumentId: created.id },
    });

    if (existing.visibility === "SHARED") {
      await tx.dealRoomDocumentRequest.updateMany({
        where: { linkedDocumentId: documentId },
        data: { linkedDocumentId: created.id, status: "RECEIVED" },
      });
      await linkUploadToOpenRequest(tx, existing.dealRoomId, existing.documentType, created.id);
    }

    const message =
      existing.documentType === "CONTRACT_DRAFT"
        ? "Contract draft replaced."
        : "Document replaced in deal room.";

    await insertDealRoomSystemUpdateInTx(tx, existing.dealRoomId, message, {
      metadata: { documentId: created.id, replacedDocumentId: documentId },
      actorUserId,
    });

    return created;
  });

  await writeDocumentAudit(actorUserId, "DEAL_ROOM_DOCUMENT_REPLACED", existing.dealRoomId, doc, room);

  return mapDealRoomDocumentRow(doc, documentPermissions(user, room, doc));
}

export async function deleteDocument(actorUserId: string, documentId: string): Promise<void> {
  const existing = await prisma.dealRoomDocument.findUnique({
    where: { id: documentId },
  });
  if (!existing || existing.status === "DELETED") notFound();

  const { user, room } = await assertCanViewDealRoom(actorUserId, existing.dealRoomId);
  const perms = documentPermissions(user, room, existing);
  if (!perms.canDelete) forbidden();

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.dealRoomDocument.update({
      where: { id: documentId },
      data: { status: "DELETED", deletedAt: now },
    });

    await tx.dealRoomDocumentRequest.updateMany({
      where: { linkedDocumentId: documentId },
      data: { linkedDocumentId: null, status: "REQUESTED" },
    });

    await insertDealRoomSystemUpdateInTx(tx, existing.dealRoomId, "Document removed from deal room.", {
      metadata: { documentId },
      actorUserId,
    });
  });

  await writeDocumentAudit(
    actorUserId,
    "DEAL_ROOM_DOCUMENT_DELETED",
    existing.dealRoomId,
    existing,
    room,
  );
}

export async function generateDownloadLink(
  actorUserId: string,
  documentId: string,
): Promise<{ url: string; fileName: string; mimeType: string }> {
  const doc = await prisma.dealRoomDocument.findUnique({
    where: { id: documentId },
    include: dealRoomDocumentInclude,
  });
  if (!doc || doc.status !== "ACTIVE") notFound();

  const { user, room } = await assertCanViewDealRoom(actorUserId, doc.dealRoomId);
  const perms = documentPermissions(user, room, doc);
  if (!perms.canDownload) forbidden();

  return {
    url: generateSignedDocumentUrl(documentId),
    fileName: doc.originalFileName,
    mimeType: doc.mimeType,
  };
}

export async function getDocumentForDownload(actorUserId: string, documentId: string) {
  const doc = await prisma.dealRoomDocument.findUnique({
    where: { id: documentId },
  });
  if (!doc || doc.status !== "ACTIVE") notFound();

  const { user, room } = await assertCanViewDealRoom(actorUserId, doc.dealRoomId);
  const perms = documentPermissions(user, room, doc);
  if (!perms.canDownload) forbidden();

  return doc;
}

export async function requestDocument(
  actorUserId: string,
  input: RequestDealRoomDocumentInput,
): Promise<void> {
  const actor = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(actor)) forbidden();

  const room = await getDealRoomRecord(input.dealRoomId);
  const dbType = DOC_TYPE_TO_DB[input.documentType];

  await prisma.$transaction(async (tx) => {
    const existing = await tx.dealRoomDocumentRequest.findFirst({
      where: {
        dealRoomId: input.dealRoomId,
        documentType: dbType,
        status: { in: ["REQUESTED", "REJECTED"] },
      },
    });

    if (existing) {
      await tx.dealRoomDocumentRequest.update({
        where: { id: existing.id },
        data: {
          status: "REQUESTED",
          requestNote: input.requestNote?.trim() || existing.requestNote,
          title: input.title?.trim() || existing.title,
          requestedByUserId: actorUserId,
          requestedAt: new Date(),
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
          linkedDocumentId: null,
        },
      });
    } else {
      await tx.dealRoomDocumentRequest.create({
        data: {
          dealRoomId: input.dealRoomId,
          documentType: dbType,
          title: input.title?.trim() || null,
          requestNote: input.requestNote?.trim() || null,
          requestedByUserId: actorUserId,
        },
      });
    }

    await insertDealRoomSystemUpdateInTx(
      tx,
      input.dealRoomId,
      "Alta requested additional documentation.",
      {
        metadata: { documentType: dbType },
        actorUserId,
      },
    );
  });

  const { touchSlaMilestone, notifyDealRoomStakeholders } = await import("@/server/deal-room-ops.service");
  await touchSlaMilestone(input.dealRoomId, "slaDocumentsRequestedAt");
  await notifyDealRoomStakeholders(
    input.dealRoomId,
    "DEAL_ROOM_DOCUMENT_REQUESTED",
    "Document requested",
    "Alta Bank has requested additional documentation.",
    `/bank/lending/deal-rooms/${input.dealRoomId}`,
  );

  await writeAuditLog({
    actorUserId,
    action: "DEAL_ROOM_DOCUMENT_REQUESTED",
    entityType: "DEAL_ROOM",
    entityId: input.dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `Document requested in deal room ${input.dealRoomId}.`,
    metadata: {
      dealRoomId: input.dealRoomId,
      documentType: dbType,
    },
  });
}

export async function reviewDocumentRequest(
  actorUserId: string,
  input: ReviewDealRoomDocumentRequestInput,
): Promise<void> {
  const actor = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(actor)) forbidden();

  const request = await prisma.dealRoomDocumentRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request) notFound();

  const room = await getDealRoomRecord(request.dealRoomId);
  const now = new Date();

  const statusMap = {
    reviewed: "REVIEWED" as const,
    approved: "APPROVED" as const,
    rejected: "REJECTED" as const,
  };

  await prisma.$transaction(async (tx) => {
    await tx.dealRoomDocumentRequest.update({
      where: { id: input.requestId },
      data: {
        status: statusMap[input.status],
        reviewNote: input.reviewNote?.trim() || null,
        reviewedByUserId: actorUserId,
        reviewedAt: now,
      },
    });

    const message =
      input.status === "approved"
        ? "Document approved."
        : input.status === "rejected"
          ? "Document rejected."
          : "Document marked as reviewed.";

    await insertDealRoomSystemUpdateInTx(tx, request.dealRoomId, message, {
      metadata: { requestId: input.requestId, status: input.status },
      actorUserId,
    });
  });

  const auditAction =
    input.status === "approved"
      ? "DEAL_ROOM_DOCUMENT_APPROVED"
      : input.status === "rejected"
        ? "DEAL_ROOM_DOCUMENT_REJECTED"
        : "DEAL_ROOM_DOCUMENT_REVIEWED";

  await writeAuditLog({
    actorUserId,
    action: auditAction,
    entityType: "DEAL_ROOM",
    entityId: request.dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `${auditAction.replaceAll("_", " ").toLowerCase()} in deal room ${request.dealRoomId}.`,
    metadata: {
      dealRoomId: request.dealRoomId,
      requestId: input.requestId,
      documentType: request.documentType,
    },
  });
}
