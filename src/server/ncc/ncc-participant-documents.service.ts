import { createHash, randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import type { NccParticipantDocument, NccParticipantDocumentStatus } from "@prisma/client";
import { DEFAULT_REQUIRED_DOCUMENTS } from "@/lib/ncc/ncc-participant-application";
import { NCC_AUDIT } from "@/lib/ncc/ncc-audit-actions";
import { canAccessInternal } from "@/lib/auth/permissions";
import { requireAuth } from "@/server/auth.service";
import { prisma } from "@/server/db";
import {
  downloadDealRoomDocument,
  resolveBlobAccessMode,
  setDocumentStorageBackend,
  type DocumentStorageBackend,
  vercelBlobDocumentStorage,
} from "@/server/document-storage.service";
import { getActiveInstitutionMembership, requireNccStaff } from "@/server/ncc/ncc-permissions.service";

export class NccParticipantDocumentError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccParticipantDocumentError";
  }
}

export const MAX_PARTICIPANT_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_PARTICIPANT_DOCUMENT_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

type AllowedMime = (typeof ALLOWED_PARTICIPANT_DOCUMENT_MIME)[number];

const MIME_TO_EXT: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const BLOCKED_EXTENSIONS = [
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".sh",
  ".bash",
  ".js",
  ".mjs",
  ".html",
  ".htm",
  ".svg",
  ".zip",
  ".rar",
  ".7z",
  ".wasm",
];

/** In-memory backend for tests / environments without blob configuration. */
const memoryStore = new Map<string, { body: Buffer; contentType: string }>();

export const memoryParticipantDocumentStorage: DocumentStorageBackend = {
  async upload(pathname, body, contentType) {
    memoryStore.set(pathname, { body: Buffer.from(body), contentType });
    return { url: `memory://${pathname}`, pathname };
  },
  async delete(pathname) {
    memoryStore.delete(pathname);
  },
  async fetch(pathname) {
    const row = memoryStore.get(pathname);
    if (!row) return null;
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(row.body));
          controller.close();
        },
      }),
      contentType: row.contentType,
      size: row.body.length,
    };
  },
};

let storage: DocumentStorageBackend = vercelBlobDocumentStorage;

function resolveStorageBackend(): DocumentStorageBackend {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return storage;
  // Production must fail closed — never fall back to in-memory document storage.
  if (process.env.NODE_ENV === "production") {
    throw new NccParticipantDocumentError(
      "PRIVATE_DOCUMENT_STORAGE_REQUIRED",
      "Persistent private document storage is required in production",
    );
  }
  return memoryParticipantDocumentStorage;
}

/** Test helper — swaps the blob backend (also wires document-storage fetch path). */
export function setParticipantDocumentStorageBackend(backend: DocumentStorageBackend): void {
  storage = backend;
  setDocumentStorageBackend(backend);
}

export type ParticipantDocumentFileInput = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ParticipantDocumentView = {
  id: string;
  applicationId: string;
  institutionId: string | null;
  documentType: string;
  status: NccParticipantDocumentStatus;
  originalFileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  uploadedByUserId: string;
  reviewedByUserId: string | null;
  reviewNote: string | null;
  expiresAt: string | null;
  replacedById: string | null;
  versionNumber: number;
  createdAt: string;
  reviewedAt: string | null;
};

function mapDoc(row: NccParticipantDocument): ParticipantDocumentView {
  return {
    id: row.id,
    applicationId: row.applicationId,
    institutionId: row.institutionId,
    documentType: row.documentType,
    status: row.status,
    originalFileName: row.originalFileName,
    contentType: row.contentType,
    byteSize: row.byteSize,
    sha256: row.sha256,
    uploadedByUserId: row.uploadedByUserId,
    reviewedByUserId: row.reviewedByUserId,
    reviewNote: row.reviewNote,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    replacedById: row.replacedById,
    versionNumber: row.versionNumber,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

function safeOriginalFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return cleaned || "document";
}

function sniffMime(buffer: Buffer): AllowedMime | null {
  if (buffer.length < 12) return null;
  // Reject PE/MZ executables and ELF binaries regardless of claimed type.
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return null;
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return null;
  }
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function validateAndSniff(file: ParticipantDocumentFileInput, body: Buffer): {
  mimeType: AllowedMime;
  ext: string;
  fileName: string;
} {
  if (!file || file.size <= 0 || body.length <= 0) {
    throw new NccParticipantDocumentError("DOCUMENT_REQUIRED", "Document file is required.");
  }
  if (file.size > MAX_PARTICIPANT_DOCUMENT_BYTES || body.length > MAX_PARTICIPANT_DOCUMENT_BYTES) {
    throw new NccParticipantDocumentError("DOCUMENT_TOO_LARGE", "Document must be 10MB or smaller.");
  }

  const lowerName = file.name.trim().toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    throw new NccParticipantDocumentError("UNSUPPORTED_FILE_TYPE", "Unsupported file type.");
  }

  const sniffed = sniffMime(body);
  if (!sniffed) {
    throw new NccParticipantDocumentError(
      "UNSUPPORTED_FILE_TYPE",
      "Only PDF, PNG, JPEG, and WebP files are accepted.",
    );
  }

  // Client MIME is advisory only — sniffed magic bytes determine acceptance.
  return {
    mimeType: sniffed,
    ext: MIME_TO_EXT[sniffed],
    fileName: safeOriginalFileName(file.name),
  };
}

async function assertMayAccessApplication(
  applicationId: string,
): Promise<{ userId: string; application: { id: string; institutionId: string | null; applicantUserId: string; requiredDocuments: unknown } }> {
  const user = await requireAuth();
  const application = await prisma.nccParticipantApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      institutionId: true,
      applicantUserId: true,
      requiredDocuments: true,
    },
  });
  if (!application) {
    throw new NccParticipantDocumentError("APPLICATION_NOT_FOUND", "Application not found.");
  }

  if (canAccessInternal(user)) {
    return { userId: user.id, application };
  }
  if (application.applicantUserId === user.id) {
    return { userId: user.id, application };
  }
  if (application.institutionId) {
    const membership = await getActiveInstitutionMembership(user.id, application.institutionId);
    if (membership) return { userId: user.id, application };
  }
  throw new NccParticipantDocumentError("FORBIDDEN", "FORBIDDEN");
}

async function writeDocAudit(input: {
  actorUserId: string;
  action: string;
  entityId: string;
  description: string;
  institutionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { writeAuditLog } = await import("@/server/audit.service");
  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: "NCC_PARTICIPANT_DOCUMENT",
    entityId: input.entityId,
    description: input.description,
    institutionId: input.institutionId ?? undefined,
    metadata: input.metadata,
  });
}

async function storeBytes(pathname: string, body: Buffer, contentType: string): Promise<string> {
  const backend = resolveStorageBackend();
  if (backend === vercelBlobDocumentStorage && process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const access = resolveBlobAccessMode();
    const blob = await put(pathname, body, {
      access,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN.trim(),
      addRandomSuffix: false,
    });
    return blob.pathname;
  }
  const result = await backend.upload(pathname, body, contentType);
  return result.pathname;
}

function requiredDocumentTypes(applicationRequired: unknown): string[] {
  if (Array.isArray(applicationRequired) && applicationRequired.every((v) => typeof v === "string")) {
    return applicationRequired as string[];
  }
  return [...DEFAULT_REQUIRED_DOCUMENTS];
}

export function isDocumentExpired(
  doc: Pick<NccParticipantDocument, "expiresAt" | "status">,
  now = new Date(),
): boolean {
  if (doc.status === "EXPIRED") return true;
  if (!doc.expiresAt) return false;
  return doc.expiresAt.getTime() <= now.getTime();
}

export async function listParticipantDocuments(
  applicationId: string,
): Promise<ParticipantDocumentView[]> {
  await assertMayAccessApplication(applicationId);
  const rows = await prisma.nccParticipantDocument.findMany({
    where: { applicationId, status: { not: "REPLACED" } },
    orderBy: [{ documentType: "asc" }, { versionNumber: "desc" }],
  });
  return rows.map(mapDoc);
}

export async function uploadParticipantDocument(input: {
  applicationId: string;
  documentType: string;
  file: ParticipantDocumentFileInput;
  expiresAt?: Date | string | null;
  replaceDocumentId?: string | null;
}): Promise<ParticipantDocumentView> {
  const { userId, application } = await assertMayAccessApplication(input.applicationId);
  const documentType = input.documentType.trim();
  if (!documentType) {
    throw new NccParticipantDocumentError("DOCUMENT_TYPE_REQUIRED", "Document type is required.");
  }

  const body = Buffer.from(await input.file.arrayBuffer());
  const { mimeType, ext, fileName } = validateAndSniff(input.file, body);
  const sha256 = createHash("sha256").update(body).digest("hex");
  const storageKey = `ncc-participant-docs/${application.id}/${randomUUID()}.${ext}`;

  let expiresAt: Date | null = null;
  if (input.expiresAt != null && input.expiresAt !== "") {
    expiresAt = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new NccParticipantDocumentError("INVALID_EXPIRATION", "Invalid expiration date.");
    }
  }

  await storeBytes(storageKey, body, mimeType);

  const created = await prisma.$transaction(async (tx) => {
    const prior = input.replaceDocumentId
      ? await tx.nccParticipantDocument.findUnique({ where: { id: input.replaceDocumentId } })
      : await tx.nccParticipantDocument.findFirst({
          where: {
            applicationId: application.id,
            documentType,
            status: { not: "REPLACED" },
          },
          orderBy: { versionNumber: "desc" },
        });

    if (input.replaceDocumentId) {
      if (!prior || prior.applicationId !== application.id) {
        throw new NccParticipantDocumentError("DOCUMENT_NOT_FOUND", "Document to replace not found.");
      }
      if (prior.status === "REPLACED") {
        throw new NccParticipantDocumentError("ALREADY_REPLACED", "Document was already replaced.");
      }
    }

    const versionNumber = prior ? prior.versionNumber + 1 : 1;

    const row = await tx.nccParticipantDocument.create({
      data: {
        applicationId: application.id,
        institutionId: application.institutionId,
        documentType,
        status: "PENDING_SCAN",
        storageKey,
        originalFileName: fileName,
        contentType: mimeType,
        byteSize: body.length,
        sha256,
        uploadedByUserId: userId,
        expiresAt,
        versionNumber,
      },
    });

    if (prior) {
      await tx.nccParticipantDocument.update({
        where: { id: prior.id },
        data: { status: "REPLACED", replacedById: row.id },
      });
    }

    return row;
  });

  const replaced = created.versionNumber > 1;
  await writeDocAudit({
    actorUserId: userId,
    action: replaced
      ? NCC_AUDIT.PARTICIPANT_DOCUMENT_REPLACED
      : NCC_AUDIT.PARTICIPANT_DOCUMENT_UPLOADED,
    entityId: created.id,
    description: `Participant document ${documentType} ${replaced ? "replaced" : "uploaded"} (v${created.versionNumber})`,
    institutionId: application.institutionId,
    metadata: {
      applicationId: application.id,
      documentType,
      contentType: mimeType,
      byteSize: body.length,
      sha256,
      versionNumber: created.versionNumber,
      // Never log file contents or storage payloads.
    },
  });

  return mapDoc(created);
}

export async function markDocumentUnderReview(
  documentId: string,
  note?: string | null,
): Promise<ParticipantDocumentView> {
  const staff = await requireNccStaff("review_documents");
  const row = await prisma.nccParticipantDocument.findUnique({ where: { id: documentId } });
  if (!row) throw new NccParticipantDocumentError("DOCUMENT_NOT_FOUND", "Document not found.");
  if (row.status !== "PENDING_SCAN" && row.status !== "UNDER_REVIEW") {
    throw new NccParticipantDocumentError(
      "INVALID_STATUS_TRANSITION",
      `Cannot move ${row.status} to UNDER_REVIEW`,
    );
  }

  const updated = await prisma.nccParticipantDocument.update({
    where: { id: documentId },
    data: {
      status: "UNDER_REVIEW",
      reviewedByUserId: staff.id,
      reviewNote: note?.trim() || row.reviewNote,
      reviewedAt: new Date(),
    },
  });
  return mapDoc(updated);
}

export async function acceptParticipantDocument(input: {
  documentId: string;
  reviewNote?: string | null;
  /** Required when accepting directly from PENDING_SCAN — staff asserts manual safe review. */
  manualSafeReviewCompleted?: boolean;
}): Promise<ParticipantDocumentView> {
  const staff = await requireNccStaff("review_documents");
  const row = await prisma.nccParticipantDocument.findUnique({ where: { id: input.documentId } });
  if (!row) throw new NccParticipantDocumentError("DOCUMENT_NOT_FOUND", "Document not found.");
  if (row.status === "ACCEPTED") return mapDoc(row);
  if (row.status === "REPLACED" || row.status === "EXPIRED") {
    throw new NccParticipantDocumentError("INVALID_STATUS_TRANSITION", `Cannot accept ${row.status}`);
  }

  if (row.status === "PENDING_SCAN") {
    if (!input.manualSafeReviewCompleted) {
      throw new NccParticipantDocumentError(
        "SCAN_PENDING",
        "Document is PENDING_SCAN. Move to UNDER_REVIEW first, or set manualSafeReviewCompleted after completing a manual safe review.",
      );
    }
  } else if (row.status !== "UNDER_REVIEW" && row.status !== "REJECTED") {
    throw new NccParticipantDocumentError(
      "INVALID_STATUS_TRANSITION",
      `Cannot accept from ${row.status}`,
    );
  }

  const note =
    input.reviewNote?.trim() ||
    (row.status === "PENDING_SCAN" && input.manualSafeReviewCompleted
      ? "Staff completed manual safe review (no automated malware scan)."
      : row.reviewNote);

  const updated = await prisma.nccParticipantDocument.update({
    where: { id: input.documentId },
    data: {
      status: "ACCEPTED",
      reviewedByUserId: staff.id,
      reviewNote: note,
      reviewedAt: new Date(),
    },
  });

  await writeDocAudit({
    actorUserId: staff.id,
    action: NCC_AUDIT.PARTICIPANT_DOCUMENT_ACCEPTED,
    entityId: updated.id,
    description: `Participant document accepted (${updated.documentType})`,
    institutionId: updated.institutionId,
    metadata: {
      applicationId: updated.applicationId,
      documentType: updated.documentType,
      priorStatus: row.status,
      manualSafeReviewCompleted: !!input.manualSafeReviewCompleted,
    },
  });

  return mapDoc(updated);
}

export async function rejectParticipantDocument(input: {
  documentId: string;
  reviewNote: string;
}): Promise<ParticipantDocumentView> {
  const staff = await requireNccStaff("review_documents");
  const note = input.reviewNote.trim();
  if (!note) {
    throw new NccParticipantDocumentError("REVIEW_NOTE_REQUIRED", "Rejection note is required.");
  }
  const row = await prisma.nccParticipantDocument.findUnique({ where: { id: input.documentId } });
  if (!row) throw new NccParticipantDocumentError("DOCUMENT_NOT_FOUND", "Document not found.");
  if (row.status === "REPLACED") {
    throw new NccParticipantDocumentError("INVALID_STATUS_TRANSITION", "Cannot reject a replaced document.");
  }

  const updated = await prisma.nccParticipantDocument.update({
    where: { id: input.documentId },
    data: {
      status: "REJECTED",
      reviewedByUserId: staff.id,
      reviewNote: note,
      reviewedAt: new Date(),
    },
  });

  await writeDocAudit({
    actorUserId: staff.id,
    action: NCC_AUDIT.PARTICIPANT_DOCUMENT_REJECTED,
    entityId: updated.id,
    description: `Participant document rejected (${updated.documentType})`,
    institutionId: updated.institutionId,
    metadata: {
      applicationId: updated.applicationId,
      documentType: updated.documentType,
      priorStatus: row.status,
    },
  });

  return mapDoc(updated);
}

/** Authenticated download helper — returns a storage stream; never a public URL. */
export async function downloadParticipantDocument(documentId: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
  originalFileName: string;
}> {
  const row = await prisma.nccParticipantDocument.findUnique({ where: { id: documentId } });
  if (!row) throw new NccParticipantDocumentError("DOCUMENT_NOT_FOUND", "Document not found.");
  await assertMayAccessApplication(row.applicationId);

  const backend = resolveStorageBackend();
  const fetched =
    backend === memoryParticipantDocumentStorage || !process.env.BLOB_READ_WRITE_TOKEN?.trim()
      ? await backend.fetch(row.storageKey)
      : await downloadDealRoomDocument(row.storageKey);

  if (!fetched) {
    throw new NccParticipantDocumentError("STORAGE_NOT_FOUND", "Document could not be retrieved.");
  }
  return {
    stream: fetched.stream,
    contentType: fetched.contentType || row.contentType,
    size: fetched.size || row.byteSize,
    originalFileName: row.originalFileName,
  };
}

export type MandatoryDocumentBlocker = {
  code: string;
  documentType: string;
  detail: string;
};

/**
 * Returns blockers when mandatory regulatory documents are missing, rejected,
 * expired, pending scan, or otherwise not accepted.
 */
export async function assertMandatoryDocumentsAccepted(
  applicationId: string,
): Promise<{ ok: true } | { ok: false; blockers: MandatoryDocumentBlocker[] }> {
  const application = await prisma.nccParticipantApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, requiredDocuments: true },
  });
  if (!application) {
    return {
      ok: false,
      blockers: [
        {
          code: "REGULATORY_DOCUMENTS_INCOMPLETE",
          documentType: "*",
          detail: "Application not found",
        },
      ],
    };
  }

  const required = requiredDocumentTypes(application.requiredDocuments);
  const docs = await prisma.nccParticipantDocument.findMany({
    where: { applicationId, status: { not: "REPLACED" } },
    orderBy: { versionNumber: "desc" },
  });

  const latestByType = new Map<string, NccParticipantDocument>();
  for (const doc of docs) {
    if (!latestByType.has(doc.documentType)) latestByType.set(doc.documentType, doc);
  }

  const blockers: MandatoryDocumentBlocker[] = [];
  const now = new Date();

  for (const documentType of required) {
    const doc = latestByType.get(documentType);
    if (!doc) {
      blockers.push({
        code: "REGULATORY_DOCUMENTS_INCOMPLETE",
        documentType,
        detail: "Missing required document",
      });
      continue;
    }
    if (doc.status === "PENDING_SCAN") {
      blockers.push({
        code: "REGULATORY_DOCUMENT_PENDING_SCAN",
        documentType,
        detail: "Document awaiting safe review",
      });
      continue;
    }
    if (doc.status === "REJECTED") {
      blockers.push({
        code: "REGULATORY_DOCUMENTS_INCOMPLETE",
        documentType,
        detail: "Document was rejected",
      });
      continue;
    }
    if (doc.status !== "ACCEPTED") {
      blockers.push({
        code: "REGULATORY_DOCUMENTS_INCOMPLETE",
        documentType,
        detail: `Document status is ${doc.status}`,
      });
      continue;
    }
    if (isDocumentExpired(doc, now)) {
      blockers.push({
        code: "REGULATORY_DOCUMENT_EXPIRED",
        documentType,
        detail: "Accepted document is expired",
      });
    }
  }

  return blockers.length === 0 ? { ok: true } : { ok: false, blockers };
}

export async function countExpiredRegulatoryDocuments(): Promise<number> {
  const now = new Date();
  return prisma.nccParticipantDocument.count({
    where: {
      OR: [
        { status: "EXPIRED" },
        { status: "ACCEPTED", expiresAt: { lte: now } },
      ],
    },
  });
}

export const nccParticipantDocumentsService = {
  listParticipantDocuments,
  uploadParticipantDocument,
  markDocumentUnderReview,
  acceptParticipantDocument,
  rejectParticipantDocument,
  downloadParticipantDocument,
  assertMandatoryDocumentsAccepted,
  countExpiredRegulatoryDocuments,
};
