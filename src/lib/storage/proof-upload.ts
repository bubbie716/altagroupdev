import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import {
  ALLOWED_PROOF_MIME_TYPES,
  MAX_PROOF_BYTES,
  type AllowedProofMimeType,
} from "@/lib/storage/proof-upload.constants";

export { ALLOWED_PROOF_MIME_TYPES, MAX_PROOF_BYTES } from "@/lib/storage/proof-upload.constants";
export type { AllowedProofMimeType } from "@/lib/storage/proof-upload.constants";

export type BankProofTransactionType = "deposit" | "withdrawal";

export interface ProofFileInput {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface BankProofUploadMetadata {
  userId: string;
  transactionType: BankProofTransactionType;
}

export interface BankProofUploadResult {
  url: string;
  pathname: string;
  fileName: string;
  mimeType: AllowedProofMimeType;
  sizeBytes: number;
  uploadedAt: Date;
}

export class ProofValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofValidationError";
  }
}

export class ProofUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofUploadError";
  }
}

const MIME_TO_EXT: Record<AllowedProofMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function safeOriginalFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "proof";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "proof";
}

function formatStorageTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function randomSuffix(): string {
  return randomBytes(3).toString("hex");
}

function normalizeMimeType(type: string): AllowedProofMimeType | null {
  const normalized = type.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (ALLOWED_PROOF_MIME_TYPES.includes(normalized as AllowedProofMimeType)) {
    return normalized as AllowedProofMimeType;
  }
  return null;
}

/** Server-side validation for deposit/withdrawal proof images. */
export function validateProofFile(file: ProofFileInput): {
  ext: string;
  mimeType: AllowedProofMimeType;
  fileName: string;
} {
  if (!file || file.size <= 0) {
    throw new ProofValidationError("Proof file is required.");
  }

  if (file.size > MAX_PROOF_BYTES) {
    throw new ProofValidationError("Proof file must be 8MB or smaller.");
  }

  const mimeType = normalizeMimeType(file.type);
  if (!mimeType) {
    throw new ProofValidationError("Only PNG, JPG, and WebP images are accepted.");
  }

  const lowerName = file.name.trim().toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    throw new ProofValidationError("PDF files are not accepted. Upload a screenshot image.");
  }

  const blockedExtensions = [".exe", ".bat", ".cmd", ".sh", ".js", ".html", ".svg", ".gif"];
  if (blockedExtensions.some((ext) => lowerName.endsWith(ext))) {
    throw new ProofValidationError("Unsupported file type.");
  }

  return {
    ext: MIME_TO_EXT[mimeType],
    mimeType,
    fileName: safeOriginalFileName(file.name),
  };
}

function buildProofPath(metadata: BankProofUploadMetadata, ext: string, uploadedAt: Date): string {
  return `bank-proofs/${safePathSegment(metadata.userId)}/${metadata.transactionType}/${formatStorageTimestamp(uploadedAt)}-${randomSuffix()}.${ext}`;
}

/** Upload proof image to Vercel Blob. Token stays server-side. */
export async function uploadBankProof(
  file: ProofFileInput,
  metadata: BankProofUploadMetadata,
): Promise<BankProofUploadResult> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new ProofUploadError("Proof storage is not configured.");
  }

  const { ext, mimeType, fileName } = validateProofFile(file);
  const uploadedAt = new Date();
  const pathname = buildProofPath(metadata, ext, uploadedAt);
  const body = Buffer.from(await file.arrayBuffer());

  try {
    const blob = await put(pathname, body, {
      access: "public",
      contentType: mimeType,
      token,
      addRandomSuffix: false,
    });

    return {
      url: blob.url,
      pathname: blob.pathname,
      fileName,
      mimeType,
      sizeBytes: file.size,
      uploadedAt,
    };
  } catch {
    throw new ProofUploadError("Proof upload failed. Please try again.");
  }
}

/** Resolve a stored proof URL/path for display. */
export { getProofFileUrl, hasStoredProof } from "@/lib/storage/proof-upload.constants";
