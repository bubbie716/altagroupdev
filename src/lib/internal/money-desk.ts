/** Shared helpers for Money directories (Phase 6). */

import type { InternalBankAccountRow } from "@/lib/bank/backend-types";
import type { TransactionExplorerRow } from "@/lib/internal/ops-types";

export function accountNeedsDirectoryAttention(account: Pick<InternalBankAccountRow, "status">): boolean {
  const s = account.status.toLowerCase();
  return s === "frozen" || s === "pending" || s.includes("frozen") || s.includes("pending");
}

export function sortAccountsForDirectory(
  accounts: InternalBankAccountRow[],
  attentionOnly = false,
): InternalBankAccountRow[] {
  const rows = attentionOnly ? accounts.filter(accountNeedsDirectoryAttention) : [...accounts];
  return rows.sort((a, b) => {
    const aAtt = accountNeedsDirectoryAttention(a) ? 0 : 1;
    const bAtt = accountNeedsDirectoryAttention(b) ? 0 : 1;
    if (aAtt !== bAtt) return aAtt - bAtt;
    const aActivity = a.lastActivityAt ?? a.createdAt;
    const bActivity = b.lastActivityAt ?? b.createdAt;
    return bActivity.localeCompare(aActivity);
  });
}

export function accountMatchesQuery(account: InternalBankAccountRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [
    account.accountName,
    account.accountNumber,
    account.holder,
    account.companyName ?? "",
    account.product,
    account.id,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export function accountActivityLabel(account: InternalBankAccountRow): string {
  const raw = account.lastActivityAt ?? account.createdAt;
  return raw.slice(0, 10);
}

export function transactionNeedsDecision(row: Pick<TransactionExplorerRow, "status">): boolean {
  return row.status.toUpperCase() === "PENDING";
}

export function transactionReviewCta(row: Pick<TransactionExplorerRow, "status" | "type">): string {
  if (row.status.toUpperCase() !== "PENDING") return "Review transaction";
  const t = row.type.toUpperCase();
  if (t === "DEPOSIT") return "Review deposit";
  if (t === "WITHDRAWAL") return "Review withdrawal";
  return "Review transaction";
}

export function transactionDirectionWord(type: string): "In" | "Out" | "—" {
  const t = type.toUpperCase();
  if (t === "DEPOSIT" || t === "INTEREST_CREDIT") return "In";
  if (t === "WITHDRAWAL" || t === "LOAN_PAYMENT" || t === "FEE" || t === "INTEREST_CHARGE") return "Out";
  return "—";
}

export function partyAccountLabel(row: Pick<TransactionExplorerRow, "holder" | "accountNumber">): string {
  return `${row.holder} · ${row.accountNumber}`;
}

export const MONEY_LIST_PAGE_SIZE = 25;
