/**
 * Product consent route/action requirements and multi-scope sequencing.
 */
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";

export type ProductConsentRequirement = {
  scopes: LegalConsentScopeId[];
  /** When true, companyId is required for COMMERCIAL. */
  companyScoped?: boolean;
  /**
   * Soft gate: show consent for new activity but allow view/repay/support.
   * Used for existing cardholder/borrower exceptions.
   */
  softForExistingObligations?: boolean;
};

/** Paths that must never show product consent (marketing, auth, legal, support, internal). */
const PRODUCT_CONSENT_EXEMPT_EXACT = new Set([
  "/",
  "/login",
  "/onboarding",
  "/maintenance",
  "/access-restricted",
  "/status",
  "/home",
]);

const PRODUCT_CONSENT_EXEMPT_PREFIXES = [
  "/onboarding",
  "/legal",
  "/support",
  "/api/",
  "/discord",
  "/status",
  "/maintenance",
  "/access-restricted",
  "/internal",
  "/governance",
  "/docs",
  "/company",
  "/contact",
  "/careers",
  "/press",
] as const;

export function isProductConsentExemptPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  if (PRODUCT_CONSENT_EXEMPT_EXACT.has(path)) return true;
  return PRODUCT_CONSENT_EXEMPT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(prefix),
  );
}

/**
 * Resolve progressive consent scopes required to enter/use a product route.
 * Returns null when the path is exempt or does not require product consent.
 */
export function resolveProductConsentRequirements(
  pathname: string,
): ProductConsentRequirement | null {
  const path = normalizePath(pathname);
  if (isProductConsentExemptPath(path)) return null;

  // Public Bank / Terminal marketing shells live at site roots when unauthenticated;
  // authenticated /bank and /terminal are product workspaces (gated by callers).

  if (path.startsWith("/bank/pay") || path.includes("/payments")) {
    return { scopes: ["BANK", "ALTA_PAY"] };
  }

  if (path.startsWith("/bank/alta-card")) {
    if (path.includes("/apply") || path.includes("/activate")) {
      return { scopes: ["BANK", "ALTA_CARD"] };
    }
    // Existing card detail/statements: soft — view/repay allowed; mutations enforce separately.
    return { scopes: ["BANK", "ALTA_CARD"], softForExistingObligations: true };
  }

  if (path.startsWith("/bank/lending")) {
    if (path.includes("/apply") || path.includes("/applications/new")) {
      return { scopes: ["BANK", "LENDING"] };
    }
    // Existing loans/deal rooms/applications: soft — view/repay allowed; new apps gated server-side.
    return { scopes: ["BANK", "LENDING"], softForExistingObligations: true };
  }

  if (path.startsWith("/bank/commercial") || path.includes("/commercial")) {
    return { scopes: ["BANK", "COMMERCIAL"], companyScoped: true };
  }

  if (path.startsWith("/terminal")) {
    return { scopes: ["TERMINAL"] };
  }

  if (path.startsWith("/bank")) {
    return { scopes: ["BANK"] };
  }

  return null;
}

/** Mutation-level consent requirements by action key. */
export const PRODUCT_CONSENT_ACTIONS = {
  "bank.open_account": { scopes: ["BANK"] as const },
  "bank.internal_transfer": { scopes: ["BANK"] as const },
  "bank.deposit": { scopes: ["BANK"] as const },
  "bank.withdraw": { scopes: ["BANK"] as const },
  "terminal.place_order": { scopes: ["TERMINAL"] as const },
  "terminal.create_portfolio": { scopes: ["TERMINAL"] as const },
  "terminal.funding": { scopes: ["BANK", "TERMINAL"] as const },
  "alta_pay.submit": { scopes: ["BANK", "ALTA_PAY"] as const },
  "alta_card.apply": { scopes: ["BANK", "ALTA_CARD"] as const },
  "alta_card.activate": { scopes: ["BANK", "ALTA_CARD"] as const },
  "alta_card.new_activity": { scopes: ["BANK", "ALTA_CARD"] as const },
  "lending.apply": { scopes: ["BANK", "LENDING"] as const },
  "commercial.enable": { scopes: ["BANK", "COMMERCIAL"] as const, companyScoped: true },
  "commercial.purchase_pro": { scopes: ["BANK", "COMMERCIAL"] as const, companyScoped: true },
  "commercial.merchant_mutation": {
    scopes: ["BANK", "COMMERCIAL"] as const,
    companyScoped: true,
  },
} as const;

export type ProductConsentActionKey = keyof typeof PRODUCT_CONSENT_ACTIONS;

export function getActionConsentRequirement(
  action: ProductConsentActionKey,
): { scopes: readonly LegalConsentScopeId[]; companyScoped?: boolean } {
  return PRODUCT_CONSENT_ACTIONS[action];
}

/**
 * Actions that must remain available without current product reacceptance
 * (repayment, statements, support, viewing existing obligations).
 */
export const PRODUCT_CONSENT_EXCEPTION_ACTIONS = new Set([
  "alta_card.view",
  "alta_card.statement",
  "alta_card.repay",
  "alta_card.autopay_manage",
  "lending.view",
  "lending.repay",
  "lending.statement",
  "lending.support",
  "support.contact",
  "account.close",
  "account.withdraw_closure",
] as const);

export function isConsentExceptionAction(action: string): boolean {
  return PRODUCT_CONSENT_EXCEPTION_ACTIONS.has(
    action as (typeof PRODUCT_CONSENT_EXCEPTION_ACTIONS extends Set<infer T> ? T : never),
  );
}

export type ConsentSequenceStep = {
  scope: LegalConsentScopeId;
  index: number;
  total: number;
  companyId?: string;
};

/** Build an ordered sequence of missing scopes for multi-scope routes. */
export function buildConsentSequence(
  missingScopes: LegalConsentScopeId[],
  companyId?: string,
): ConsentSequenceStep[] {
  const total = missingScopes.length;
  return missingScopes.map((scope, index) => ({
    scope,
    index: index + 1,
    total,
    companyId: scope === "COMMERCIAL" ? companyId : undefined,
  }));
}

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (trimmed.length > 1 && trimmed.endsWith("/")) return trimmed.slice(0, -1);
  return trimmed || "/";
}
