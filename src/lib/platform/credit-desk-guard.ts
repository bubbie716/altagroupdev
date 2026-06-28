/** Paths that submit new credit applications — blocked when the Credit Desk is closed. */

export const CREDIT_DESK_CLOSED_ROUTE = "/bank/credit-desk-closed";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

export function isCreditDeskApplicationPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (path === "/bank/lending/apply") return true;
  if (path === "/bank/alta-card/apply") return true;
  if (path === "/bank/alta-card/business/apply") return true;

  // New account review request forms (not existing review detail or Secure Deal Room).
  if (/^\/bank\/alta-card\/[^/]+\/review$/.test(path)) return true;
  if (/^\/bank\/alta-card\/business\/[^/]+\/review$/.test(path)) return true;

  return false;
}
