import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

/**
 * Merge the two account activity feeds without showing the same ledger event
 * twice. Pending rows are applied last so their current review status wins if
 * a transaction appears in both feeds.
 */
export function mergeRecentAccountTransactions(
  pending: InternalBankTransactionRow[],
  recent: InternalBankTransactionRow[],
  limit = 5,
): InternalBankTransactionRow[] {
  const byId = new Map<string, InternalBankTransactionRow>();
  for (const row of recent) byId.set(row.id, row);
  for (const row of pending) byId.set(row.id, row);
  return [...byId.values()]
    .sort((a, b) => b.submitted.localeCompare(a.submitted))
    .slice(0, Math.max(0, limit));
}
