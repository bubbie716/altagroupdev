import type { AltaUser, CompanyRole, EnrichedCompanyMembership } from "@/lib/auth/types";
import { hasTag } from "@/lib/auth/tags";

/** Company roles that may access the issuer portal (VIEWER excluded). */
export const ISSUER_PORTAL_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
  "compliance_contact",
] as const;

/** Roles that may manage company settings and representatives. */
export const COMPANY_MANAGEMENT_ROLES: readonly CompanyRole[] = ["owner", "executive"] as const;

export type CompanyScope = {
  companyId?: string;
  ticker?: string;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export function findCompanyMembership(
  user: AltaUser,
  scope: CompanyScope,
): EnrichedCompanyMembership | undefined {
  if (scope.companyId) {
    return user.companyMemberships.find((m) => m.companyId === scope.companyId);
  }
  if (scope.ticker) {
    const target = normalizeTicker(scope.ticker);
    return user.companyMemberships.find(
      (m) => m.companyTicker && normalizeTicker(m.companyTicker) === target,
    );
  }
  return undefined;
}

function hasCompanyRole(user: AltaUser, scope: CompanyScope, roles: readonly CompanyRole[]): boolean {
  const membership = findCompanyMembership(user, scope);
  return membership ? roles.includes(membership.role) : false;
}

// — Global permissions (UserTagAssignment) —

export function isAdmin(user: AltaUser): boolean {
  return hasTag(user, "admin");
}

export function isOperator(user: AltaUser): boolean {
  return hasTag(user, "operator");
}

export function isPrivateClient(user: AltaUser): boolean {
  return hasTag(user, "private_client");
}

/** Developer tag or approved developer access workflow on the user record. */
export function isDeveloper(user: AltaUser): boolean {
  return hasTag(user, "developer") || user.developerAccess;
}

export function isIssuer(user: AltaUser): boolean {
  return hasTag(user, "issuer");
}

/** Internal console: admin (full) or operator (non-admin internal). */
export function canAccessInternal(user: AltaUser): boolean {
  return isAdmin(user) || isOperator(user);
}

// — Company-scoped permissions (CompanyMembership) —

export function isCompanyOwner(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ["owner"]);
}

export function isCompanyExecutive(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ["executive"]);
}

export function isCompanyFinanceManager(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ["finance_manager"]);
}

export function isCompanyComplianceContact(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ["compliance_contact"]);
}

export function canManageCompany(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, COMPANY_MANAGEMENT_ROLES);
}

export function canSubmitFilings(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ISSUER_PORTAL_ROLES);
}

export function canAccessIssuerPortal(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ISSUER_PORTAL_ROLES);
}
