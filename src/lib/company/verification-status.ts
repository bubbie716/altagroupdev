/** Normalize verification status from DB enum or display label. */
export type CompanyVerificationState = "unverified" | "pending" | "verified" | "rejected";

export function normalizeCompanyVerificationStatus(status: string): CompanyVerificationState {
  const normalized = status.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "VERIFIED") return "verified";
  if (normalized === "REJECTED") return "rejected";
  if (normalized === "PENDING" || normalized === "PENDING_REVIEW") return "pending";
  return "unverified";
}

export function isCompanyVerificationTerminal(status: string): boolean {
  const state = normalizeCompanyVerificationStatus(status);
  return state === "verified" || state === "rejected";
}
