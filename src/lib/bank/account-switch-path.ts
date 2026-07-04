import type { CompanyRole } from "@/lib/auth/types";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import {
  BUSINESS_ACCOUNT_MODULES,
  canAccessBusinessModule,
  type BusinessAccountModule,
} from "@/lib/bank/business-account-access";

const PERSONAL_ACCOUNT_SUFFIXES = new Set(["", "/activity", "/statements", "/settings"]);

const BUSINESS_MODULE_SUFFIX: Record<BusinessAccountModule, string> = {
  overview: "",
  activity: "/activity",
  payments: "/payments",
  payroll: "/payroll",
  statements: "/statements",
  representatives: "/representatives",
  settings: "/settings",
};

const SUFFIX_TO_BUSINESS_MODULE = Object.fromEntries(
  Object.entries(BUSINESS_MODULE_SUFFIX).map(([module, suffix]) => [
    suffix || "",
    module as BusinessAccountModule,
  ]),
) as Record<string, BusinessAccountModule>;

function isBusinessAccount(account: UserBankAccount): boolean {
  return account.accountType === "business_operating" || account.isCompanyAccount;
}

export function extractAccountPathSuffix(pathname: string, accountId: string): string {
  const base = `/bank/account/${accountId}`;
  if (!pathname.startsWith(base)) return "";
  const rest = pathname.slice(base.length);
  if (!rest || rest === "/") return "";
  if (rest.startsWith("/commercial")) return rest;
  if (rest === "/payments" || rest.startsWith("/payments/")) return "/commercial";
  if (rest === "/payroll" || rest.startsWith("/payroll/")) return "/commercial/payroll";
  const segmentMatch = rest.match(/^\/[^/]+/);
  return segmentMatch ? segmentMatch[0] : "";
}

function suffixAllowedForAccount(
  suffix: string,
  account: UserBankAccount,
  companyRole?: CompanyRole,
): boolean {
  if (!isBusinessAccount(account)) {
    return PERSONAL_ACCOUNT_SUFFIXES.has(suffix);
  }

  if (!suffix) return true;

  if (suffix.startsWith("/commercial")) {
    if (!companyRole) return false;
    if (suffix === "/commercial/payroll" || suffix.startsWith("/commercial/payroll/")) {
      return canAccessBusinessModule(companyRole, "payroll");
    }
    return true;
  }

  const module = SUFFIX_TO_BUSINESS_MODULE[suffix];
  if (!module || !BUSINESS_ACCOUNT_MODULES.includes(module)) return false;
  if (!companyRole) return false;

  return canAccessBusinessModule(companyRole, module);
}

export function resolveAccountSwitchSuffix(
  pathname: string,
  currentAccountId: string,
  nextAccount: UserBankAccount,
  companyRole?: CompanyRole,
): string {
  const suffix = extractAccountPathSuffix(pathname, currentAccountId);
  return suffixAllowedForAccount(suffix, nextAccount, companyRole) ? suffix : "";
}
