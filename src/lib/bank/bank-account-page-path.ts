/** True when the current path is an individual account page (or a nested tab). */
export function isBankAccountPagePath(pathname: string, accountId?: string): boolean {
  if (!accountId) return false;
  const base = `/bank/account/${accountId}`;
  return pathname === base || pathname.startsWith(`${base}/`);
}
