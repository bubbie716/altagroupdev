/** Company roles that count as ownership for personal relationship aggregation. */
export function isOwnerCompanyRole(role: string): boolean {
  return role === "OWNER" || role === "owner";
}

export function resolveOwnedCompanyIds(
  memberships: ReadonlyArray<{ companyId: string; role: string }>,
): string[] {
  return memberships.filter((m) => isOwnerCompanyRole(m.role)).map((m) => m.companyId);
}

export function countVerifiedOwnedCompanies(
  memberships: ReadonlyArray<{ companyId: string; role: string; company: { verificationStatus: string } }>,
): number {
  return memberships.filter(
    (m) => isOwnerCompanyRole(m.role) && m.company.verificationStatus === "VERIFIED",
  ).length;
}
