import type { UserBankAccount, UserBankTransaction } from "@/lib/bank/backend-types";

export type BankHomeContextId = "personal" | "all" | `company:${string}`;

export type BankHomeCompanyOption = {
  id: string;
  name: string;
};

export type BankHomeContextOption = {
  id: BankHomeContextId;
  label: string;
};

const STORAGE_PREFIX = "alta-bank-home-context:";

export function bankHomeContextStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function parseBankHomeContextId(raw: string | null | undefined): BankHomeContextId | null {
  if (!raw) return null;
  if (raw === "personal" || raw === "all") return raw;
  if (raw.startsWith("company:") && raw.length > "company:".length) {
    return raw as BankHomeContextId;
  }
  return null;
}

export function readStoredBankHomeContext(userId: string): BankHomeContextId | null {
  if (typeof window === "undefined") return null;
  try {
    return parseBankHomeContextId(window.localStorage.getItem(bankHomeContextStorageKey(userId)));
  } catch {
    return null;
  }
}

export function writeStoredBankHomeContext(userId: string, contextId: BankHomeContextId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(bankHomeContextStorageKey(userId), contextId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function buildBankHomeContextOptions(
  companies: BankHomeCompanyOption[],
): BankHomeContextOption[] {
  const options: BankHomeContextOption[] = [{ id: "personal", label: "Personal" }];
  for (const company of companies) {
    options.push({ id: `company:${company.id}`, label: company.name });
  }
  if (companies.length > 0) {
    options.push({ id: "all", label: "All accounts" });
  }
  return options;
}

export function resolveInitialBankHomeContext(
  stored: BankHomeContextId | null,
  options: BankHomeContextOption[],
): BankHomeContextId {
  if (stored && options.some((o) => o.id === stored)) return stored;
  if (options.some((o) => o.id === "all")) return "all";
  return "personal";
}

export function companiesFromAccounts(accounts: UserBankAccount[]): BankHomeCompanyOption[] {
  const map = new Map<string, string>();
  for (const account of accounts) {
    if (!account.companyId || !account.companyName) continue;
    if (!map.has(account.companyId)) map.set(account.companyId, account.companyName);
  }
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterAccountsForContext(
  accounts: UserBankAccount[],
  contextId: BankHomeContextId,
): UserBankAccount[] {
  if (contextId === "all") return accounts;
  if (contextId === "personal") {
    return accounts.filter((account) => !account.isCompanyAccount && !account.companyId);
  }
  const companyId = contextId.slice("company:".length);
  return accounts.filter((account) => account.companyId === companyId);
}

export function filterTransactionsForContext(
  transactions: UserBankTransaction[],
  accounts: UserBankAccount[],
): UserBankTransaction[] {
  const ids = new Set(accounts.map((account) => account.id));
  return transactions.filter((tx) => ids.has(tx.bankAccountId));
}

export function sumAvailableBalance(accounts: UserBankAccount[]): number {
  let total = 0;
  for (const account of accounts) {
    if (account.status !== "active") continue;
    total += account.availableBalance;
  }
  return total;
}

export function sumLedgerBalance(accounts: UserBankAccount[]): number {
  let total = 0;
  for (const account of accounts) {
    if (account.status !== "active") continue;
    total += account.balance;
  }
  return total;
}

export function contextCanTransact(accounts: UserBankAccount[]): boolean {
  return accounts.some(
    (account) =>
      account.status === "active" &&
      (!account.restrictDeposits || !account.restrictWithdrawals || !account.restrictTransfers),
  );
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\s+/g, "");
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
