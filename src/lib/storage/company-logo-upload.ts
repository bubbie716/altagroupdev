import { randomBytes } from "node:crypto";
import { put } from "@vercel/blob";
import {
  ALLOWED_PROOF_MIME_TYPES,
  MAX_PROOF_BYTES,
  type AllowedProofMimeType,
} from "@/lib/storage/proof-upload.constants";

export { MAX_PROOF_BYTES as MAX_COMPANY_LOGO_BYTES } from "@/lib/storage/proof-upload.constants";

export type CompanyLogoFileInput = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export class CompanyLogoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyLogoValidationError";
  }
}

const MIME_TO_EXT: Record<AllowedProofMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function normalizeMimeType(type: string): AllowedProofMimeType | null {
  const normalized = type.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (ALLOWED_PROOF_MIME_TYPES.includes(normalized as AllowedProofMimeType)) {
    return normalized as AllowedProofMimeType;
  }
  return null;
}

export function validateCompanyLogoFile(file: CompanyLogoFileInput): AllowedProofMimeType {
  if (file.size <= 0) {
    throw new CompanyLogoValidationError("Logo file is empty.");
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new CompanyLogoValidationError("Logo must be 8 MB or smaller.");
  }
  const mimeType = normalizeMimeType(file.type);
  if (!mimeType) {
    throw new CompanyLogoValidationError("Logo must be PNG, JPG, or WebP.");
  }
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".svg") || lowerName.endsWith(".gif")) {
    throw new CompanyLogoValidationError("SVG and GIF logos are not supported.");
  }
  return mimeType;
}

export async function uploadCompanyLogo(
  companyId: string,
  file: CompanyLogoFileInput,
): Promise<{ url: string; pathname: string; mimeType: AllowedProofMimeType }> {
  const mimeType = validateCompanyLogoFile(file);
  const ext = MIME_TO_EXT[mimeType];
  const pathname = `company-branding/${companyId}/${Date.now()}-${randomBytes(3).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
  });
  return { url: blob.url, pathname: blob.pathname, mimeType };
}
