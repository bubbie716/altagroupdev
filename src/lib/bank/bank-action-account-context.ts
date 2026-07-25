import type { UserBankAccount } from "@/lib/bank/backend-types";
import type { BankHomeContextId } from "@/lib/bank/bank-home-context";
import { filterAccountsForContext } from "@/lib/bank/bank-home-context";
import { florin } from "@/lib/bank/api";

export type BankActionAccountContext = {
  /** Explicit launcher / URL account. */
  accountId?: string;
  /** Dashboard workspace context. */
  workspace?: BankHomeContextId;
  /** Company id when workspace is company-scoped (optional shortcut). */
  companyId?: string;
};

export type AccountEligibility =
  | "transfer_source"
  | "transfer_destination"
  | "deposit"
  | "withdraw"
  | "any";

export function isAccountEligible(
  account: UserBankAccount,
  kind: AccountEligibility,
): boolean {
  if (account.status !== "active") return false;
  if (kind === "any") return true;
  if (kind === "deposit") return !account.restrictDeposits;
  if (kind === "withdraw") return !account.restrictWithdrawals;
  if (kind === "transfer_source") return !account.restrictTransfers;
  if (kind === "transfer_destination") return !account.restrictDeposits;
  return true;
}

/**
 * Accounts visible for a Bank action given workspace / company context.
 * Never silently crosses personal ↔ company or company ↔ company.
 */
export function listAccountsForActionContext(
  accounts: UserBankAccount[],
  context: BankActionAccountContext | undefined,
  eligibility: AccountEligibility = "any",
): UserBankAccount[] {
  let scoped = accounts;

  if (context?.workspace) {
    scoped = filterAccountsForContext(accounts, context.workspace);
  } else if (context?.companyId) {
    scoped = accounts.filter((account) => account.companyId === context.companyId);
  } else if (context?.accountId) {
    // Account-detail launchers: lock ownership to the explicit account's scope.
    const explicit = accounts.find((account) => account.id === context.accountId);
    if (explicit) {
      scoped = explicit.companyId
        ? accounts.filter((account) => account.companyId === explicit.companyId)
        : accounts.filter((account) => !account.companyId);
    }
  }

  return scoped.filter((account) => isAccountEligible(account, eligibility));
}

/**
 * Deterministic account preselection for Bank action workflows.
 *
 * Priority:
 * 1. Explicit accountId when eligible in scope
 * 2. Current workspace / company / account-detail ownership context
 * 3. First eligible account within that same context
 *
 * Never silently crosses personal ↔ company ownership.
 */
export function resolvePreferredAccountId(
  accounts: UserBankAccount[],
  context: BankActionAccountContext | undefined,
  eligibility: AccountEligibility = "any",
): string | null {
  const scoped = listAccountsForActionContext(accounts, context, eligibility);

  if (context?.accountId) {
    const explicit = scoped.find((account) => account.id === context.accountId);
    if (explicit) return explicit.id;
  }

  return scoped[0]?.id ?? null;
}

export function resolveTransferPair(
  accounts: UserBankAccount[],
  context: BankActionAccountContext | undefined,
): { fromAccountId: string; toAccountId: string } {
  const sources = listAccountsForActionContext(accounts, context, "transfer_source");
  const fromAccountId =
    (context?.accountId && sources.some((a) => a.id === context.accountId)
      ? context.accountId
      : sources[0]?.id) ?? "";

  const from = accounts.find((account) => account.id === fromAccountId);
  const destinations = listAccountsForActionContext(
    accounts,
    context,
    "transfer_destination",
  ).filter((account) => account.id !== fromAccountId);

  // Prefer destinations in the same ownership scope as the source.
  const sameScope = destinations.filter((account) => {
    if (!from) return true;
    if (from.companyId) return account.companyId === from.companyId;
    return !account.companyId;
  });

  const toAccountId = (sameScope[0] ?? destinations[0])?.id ?? "";
  return { fromAccountId, toAccountId };
}

/** Destinations for Transfer: same ownership context, excluding From. */
export function listTransferDestinations(
  accounts: UserBankAccount[],
  context: BankActionAccountContext | undefined,
  fromAccountId: string,
): UserBankAccount[] {
  const from = accounts.find((account) => account.id === fromAccountId);
  return listAccountsForActionContext(accounts, context, "transfer_destination").filter(
    (account) => {
      if (account.id === fromAccountId) return false;
      if (!from) return true;
      if (from.companyId) return account.companyId === from.companyId;
      return !account.companyId;
    },
  );
}

export function formatAccountOptionPrimary(account: UserBankAccount): string {
  return account.accountName;
}

export function formatAccountOptionSecondary(account: UserBankAccount): string {
  const owner = account.companyName ?? "Personal";
  const available = account.availableBalance ?? account.balance ?? 0;
  return `${owner} · ${account.accountNumber} · ${florin(available)} avail.`;
}
