export const MAX_PROOF_BYTES = 8 * 1024 * 1024;

export const ALLOWED_PROOF_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const ACCEPTED_PROOF_INPUT = "image/png,image/jpeg,image/webp";

export type AllowedProofMimeType = (typeof ALLOWED_PROOF_MIME_TYPES)[number];

/** Resolve a stored proof URL/path for display. Private blobs use authenticated download routes. */
export function getProofFileUrl(
  pathOrUrl: string | null | undefined,
  options?: { transactionId?: string },
): string | null {
  if (!pathOrUrl?.trim()) return null;
  const value = pathOrUrl.trim();
  if (value.startsWith("pending-upload://")) return null;
  if (options?.transactionId) {
    if (
      value.startsWith("bank-proofs/") ||
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      return `/api/bank/transactions/${options.transactionId}/proof`;
    }
  }
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("bank-proofs/")) return null;
  return null;
}

export function resolveProofStorageKey(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl?.trim()) return null;
  const value = pathOrUrl.trim();
  if (value.startsWith("bank-proofs/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const pathname = url.pathname.replace(/^\//, "");
      if (pathname.startsWith("bank-proofs/")) return pathname;
    } catch {
      return null;
    }
  }
  return null;
}

export function hasStoredProof(proofImageUrl: string | null | undefined): boolean {
  if (!proofImageUrl?.trim()) return false;
  const value = proofImageUrl.trim();
  if (value.startsWith("pending-upload://")) return false;
  return (
    value.startsWith("bank-proofs/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  );
}
