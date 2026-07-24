import type { AltaUser, CompanyRole, EnrichedCompanyMembership } from "@/lib/auth/types";
import type { SiteKey } from "@/config/sites";
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

const COMPANY_ROLE_RANK: Record<CompanyRole, number> = {
  owner: 5,
  executive: 4,
  finance_manager: 3,
  compliance_contact: 2,
  viewer: 1,
};

export function companyRoleRank(role: CompanyRole): number {
  return COMPANY_ROLE_RANK[role];
}

export function isCompanyRoleAbove(above: CompanyRole, below: CompanyRole): boolean {
  return COMPANY_ROLE_RANK[above] > COMPANY_ROLE_RANK[below];
}

/** Whether an actor may change or remove a member who currently holds `targetRole`. */
export function canManageCompanyMember(actorRole: CompanyRole, targetRole: CompanyRole): boolean {
  if (actorRole === "owner") return true;
  return isCompanyRoleAbove(actorRole, targetRole);
}

/** Whether an actor may assign or invite someone to `assignRole`. */
export function canAssignCompanyRole(actorRole: CompanyRole, assignRole: CompanyRole): boolean {
  if (actorRole === "owner") return true;
  return isCompanyRoleAbove(actorRole, assignRole);
}

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

export function isCorporateAdmin(user: AltaUser): boolean {
  return hasTag(user, "corporate_admin");
}

export function isBankAdmin(user: AltaUser): boolean {
  return hasTag(user, "bank_admin");
}

export function isTerminalAdmin(user: AltaUser): boolean {
  return hasTag(user, "terminal_admin");
}

/** Corporate admin — full group control (alias kept for existing call sites). */
export function isAdmin(user: AltaUser): boolean {
  return isCorporateAdmin(user);
}

export function isPrivateClient(user: AltaUser): boolean {
  return hasTag(user, "private_client");
}

/** Approved developer access workflow on the user record (legacy Exchange field). */
export function isDeveloper(user: AltaUser): boolean {
  return user.developerAccess;
}

/** Any Alta staff tag (corporate / bank / terminal). */
export function canAccessAnyInternal(user: AltaUser): boolean {
  return isCorporateAdmin(user) || isBankAdmin(user) || isTerminalAdmin(user);
}

/** Bank ops console — corporate or bank admin (not terminal-only staff). */
export function canAccessBankInternal(user: AltaUser): boolean {
  return isCorporateAdmin(user) || isBankAdmin(user);
}

/**
 * Alta platform staff used by NCC portal / internal platform helpers.
 * Preserves pre-split behavior: only corporate admins (former global admin).
 */
export function canAccessInternal(user: AltaUser): boolean {
  return isCorporateAdmin(user);
}

/** Whether the user may open `/internal` on the given site. NCC is always false. */
export function canAccessInternalForSite(user: AltaUser, siteKey: SiteKey): boolean {
  switch (siteKey) {
    case "corporate":
      return isCorporateAdmin(user);
    case "bank":
      return canAccessBankInternal(user);
    case "terminal":
    case "exchange":
      return isCorporateAdmin(user) || isTerminalAdmin(user);
    case "ncc":
      return false;
  }
}

/** Corporate admins bypass maintenance mode on public and internal routes. */
export function canBypassMaintenanceMode(user: AltaUser | null | undefined): boolean {
  if (!user) return false;
  return isCorporateAdmin(user);
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

/** Roles that may view business treasury (Business Banking). VIEWER excluded. */
export const BUSINESS_TREASURY_VIEW_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
  "compliance_contact",
] as const;

/** Roles that may create payments and payroll batches. */
export const BUSINESS_TREASURY_MANAGE_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
] as const;

export function canViewBusinessTreasury(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, BUSINESS_TREASURY_VIEW_ROLES);
}

export function isCompanyViewer(user: AltaUser, scope: CompanyScope): boolean {
  const membership = findCompanyMembership(user, scope);
  return membership?.role === "viewer";
}

/** Company business Alta Card line (not employee cards). Viewers are excluded. */
export function canViewCompanyAltaCard(user: AltaUser, companyId: string): boolean {
  if (canAccessBankInternal(user)) return true;
  if (isCompanyViewer(user, { companyId })) return false;
  return canViewBusinessTreasury(user, { companyId });
}

export function canManageCompanyAltaCard(user: AltaUser, companyId: string): boolean {
  if (canAccessBankInternal(user)) return true;
  if (isCompanyViewer(user, { companyId })) return false;
  return canManageBusinessTreasury(user, { companyId });
}

/** Main company Alta Card credit line for Alta Pay (not employee cards). Viewers excluded. */
export function canUseBusinessAltaCardLineForAltaPay(user: AltaUser, companyId: string): boolean {
  if (isCompanyViewer(user, { companyId })) return false;
  return canManageBusinessTreasury(user, { companyId });
}

export function canManageBusinessTreasury(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, BUSINESS_TREASURY_MANAGE_ROLES);
}

/** Roles that may view a company-linked Secure Deal Room. */
export const DEAL_ROOM_COMPANY_VIEW_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
  "compliance_contact",
] as const;

export function canViewCompanyDealRoom(user: AltaUser, companyId: string): boolean {
  return hasCompanyRole(user, { companyId }, DEAL_ROOM_COMPANY_VIEW_ROLES);
}

/** Roles that may negotiate (counter, accept, reject) in a company deal room. */
export const DEAL_ROOM_COMPANY_NEGOTIATE_ROLES: readonly CompanyRole[] =
  BUSINESS_TREASURY_MANAGE_ROLES;

export function canNegotiateCompanyDealRoom(user: AltaUser, companyId: string): boolean {
  return hasCompanyRole(user, { companyId }, DEAL_ROOM_COMPANY_NEGOTIATE_ROLES);
}

export function isBusinessTreasuryViewOnly(user: AltaUser, scope: CompanyScope): boolean {
  const membership = findCompanyMembership(user, scope);
  return membership?.role === "compliance_contact";
}

/** Roles that may view incoming Alta Pay payments on the business dashboard. */
export const ALTA_PAY_RECEIVED_VIEW_ROLES: readonly CompanyRole[] = [
  "owner",
  "executive",
  "finance_manager",
] as const;

export function canViewAltaPayReceived(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, ALTA_PAY_RECEIVED_VIEW_ROLES);
}

/** Roles that may create, send, and cancel merchant invoices. */
export const MERCHANT_INVOICE_MANAGE_ROLES = BUSINESS_TREASURY_MANAGE_ROLES;

/** Roles that may view merchant invoice dashboard and details. */
export const MERCHANT_INVOICE_VIEW_ROLES = BUSINESS_TREASURY_VIEW_ROLES;

export function canManageMerchantInvoices(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, MERCHANT_INVOICE_MANAGE_ROLES);
}

export function canViewMerchantInvoices(user: AltaUser, scope: CompanyScope): boolean {
  return hasCompanyRole(user, scope, MERCHANT_INVOICE_VIEW_ROLES);
}

export type MerchantInvoiceRecipientScope = {
  recipientUserId: string | null;
  recipientCompanyId: string | null;
};

export function canViewReceivedMerchantInvoice(
  user: AltaUser,
  invoice: MerchantInvoiceRecipientScope,
): boolean {
  if (invoice.recipientUserId) return invoice.recipientUserId === user.id;
  if (invoice.recipientCompanyId) {
    return canViewMerchantInvoices(user, { companyId: invoice.recipientCompanyId });
  }
  return false;
}

export function canPayReceivedMerchantInvoice(
  user: AltaUser,
  invoice: MerchantInvoiceRecipientScope,
): boolean {
  if (invoice.recipientUserId) return invoice.recipientUserId === user.id;
  if (invoice.recipientCompanyId) {
    return canManageMerchantInvoices(user, { companyId: invoice.recipientCompanyId });
  }
  return false;
}

/** Roles that may create and manage payment links. */
export const PAYMENT_LINK_MANAGE_ROLES = MERCHANT_INVOICE_MANAGE_ROLES;
export const PAYMENT_LINK_VIEW_ROLES = MERCHANT_INVOICE_VIEW_ROLES;

export function canManagePaymentLinks(user: AltaUser, scope: CompanyScope): boolean {
  return canManageMerchantInvoices(user, scope);
}

export function canViewPaymentLinks(user: AltaUser, scope: CompanyScope): boolean {
  return canViewMerchantInvoices(user, scope);
}
