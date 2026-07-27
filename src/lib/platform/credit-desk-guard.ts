/** Paths that submit new credit applications — blocked when the Credit Desk is closed. */

export const CREDIT_DESK_CLOSED_ROUTE = "/bank/credit-desk-closed";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function hasApplySearch(search?: Record<string, unknown>): boolean {
  if (!search) return false;
  return search.apply === "1" || search.apply === 1;
}

export function isCreditDeskApplicationPath(
  pathname: string,
  search?: Record<string, unknown>,
): boolean {
  const path = normalizePath(pathname);

  if (path === "/bank/lending/apply") return true;
  if (path === "/bank/alta-card/apply") return true;
  if (path === "/bank/alta-card/business/apply") return true;

  // Query-driven apply modals on product pages
  if (hasApplySearch(search)) {
    if (path === "/bank/alta-card") return true;
    if (path === "/bank/alta-card/business") return true;
    if (path === "/bank/lending") return true;
  }

  // New account review request forms (not existing review detail or Secure Deal Room).
  if (/^\/bank\/alta-card\/[^/]+\/review$/.test(path)) return true;
  if (/^\/bank\/alta-card\/business\/[^/]+\/review$/.test(path)) return true;

  return false;
}
