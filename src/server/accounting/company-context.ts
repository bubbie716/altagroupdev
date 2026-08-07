/**
 * Active company cookie for Alta Accounting (corporate-admin books).
 */
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { buildClearCookie, buildSetCookie, readCookie } from "@/server/session";

export const ACCOUNTING_COMPANY_COOKIE = "alta_accounting_company";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export function readAccountingCompanyIdFromRequest(): string | null {
  const cookieHeader = getRequestHeader("cookie");
  const raw = readCookie(ACCOUNTING_COMPANY_COOKIE, cookieHeader);
  if (!raw?.trim()) return null;
  return raw.trim().slice(0, 64);
}

export function setAccountingCompanyCookie(companyId: string): void {
  const requestHost = getRequestHeader("host") ?? undefined;
  setResponseHeader(
    "Set-Cookie",
    buildSetCookie(ACCOUNTING_COMPANY_COOKIE, companyId, MAX_AGE_SEC, requestHost),
  );
}

export function clearAccountingCompanyCookie(): void {
  const requestHost = getRequestHeader("host") ?? undefined;
  setResponseHeader(
    "Set-Cookie",
    buildClearCookie(ACCOUNTING_COMPANY_COOKIE, requestHost),
  );
}
