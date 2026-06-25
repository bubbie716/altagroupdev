const STORAGE_PREFIX = "alta-bank-hidden-closed";

export function hiddenClosedAccountsStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function readHiddenClosedAccountIds(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(hiddenClosedAccountsStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

export function writeHiddenClosedAccountIds(userId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    hiddenClosedAccountsStorageKey(userId),
    JSON.stringify([...ids]),
  );
}

export function hideClosedAccount(userId: string, accountId: string): Set<string> {
  const next = readHiddenClosedAccountIds(userId);
  next.add(accountId);
  writeHiddenClosedAccountIds(userId, next);
  return next;
}
