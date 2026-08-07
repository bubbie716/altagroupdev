/**
 * Active org cookie for Accounting Tracker (local AccountingOrg, not Alta Company).
 */
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { buildClearCookie, buildSetCookie, readCookie } from "@/server/session";

export const ACCOUNTING_ORG_COOKIE = "alta_accounting_org";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export function readAccountingOrgIdFromRequest(): string | null {
  const cookieHeader = getRequestHeader("cookie");
  const raw = readCookie(ACCOUNTING_ORG_COOKIE, cookieHeader);
  if (!raw?.trim()) return null;
  return raw.trim().slice(0, 64);
}

export function setAccountingOrgCookie(orgId: string): void {
  const requestHost = getRequestHeader("host") ?? undefined;
  setResponseHeader(
    "Set-Cookie",
    buildSetCookie(ACCOUNTING_ORG_COOKIE, orgId, MAX_AGE_SEC, requestHost),
  );
}

export function clearAccountingOrgCookie(): void {
  const requestHost = getRequestHeader("host") ?? undefined;
  setResponseHeader(
    "Set-Cookie",
    buildClearCookie(ACCOUNTING_ORG_COOKIE, requestHost),
  );
}
