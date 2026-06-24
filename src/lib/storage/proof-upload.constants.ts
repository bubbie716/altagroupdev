export const MAX_PROOF_BYTES = 8 * 1024 * 1024;

export const ALLOWED_PROOF_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const ACCEPTED_PROOF_INPUT = "image/png,image/jpeg,image/webp";

export type AllowedProofMimeType = (typeof ALLOWED_PROOF_MIME_TYPES)[number];

/** Resolve a stored proof URL/path for display. */
export function getProofFileUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl?.trim()) return null;
  const value = pathOrUrl.trim();
  if (value.startsWith("pending-upload://")) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://blob.vercel-storage.com/${value.replace(/^\//, "")}`;
}

export function hasStoredProof(proofImageUrl: string | null | undefined): boolean {
  return getProofFileUrl(proofImageUrl) !== null;
}
