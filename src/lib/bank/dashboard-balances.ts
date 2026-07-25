import type { UserBankAccount, UserBankDashboard } from "@/lib/bank/backend-types";

function accountText(
  account: Pick<UserBankAccount, "accountName" | "name" | "product">,
): string {
  return `${account.accountName} ${account.name} ${account.product}`.toLowerCase();
}

/** Summit Money Market (`private` type or Summit-branded name). */
export function isSummitMoneyMarketAccount(
  account: Pick<UserBankAccount, "accountType" | "accountName" | "name" | "product">,
): boolean {
  if (account.accountType === "private") return true;
  const text = accountText(account);
  return text.includes("summit") && text.includes("money market");
}

/** Retail Alta Money Market (`money_market` type or legacy savings-branded; not Summit). */
export function isRetailAltaMoneyMarketAccount(
  account: Pick<UserBankAccount, "accountType" | "accountName" | "name" | "product">,
): boolean {
  if (account.accountType === "money_market") return true;
  const text = accountText(account);
  if (text.includes("summit")) return false;
  if (text.includes("alta money market")) return true;
  return account.accountType === "savings" && text.includes("money market");
}

export function isReserveAccount(
  account: Pick<UserBankAccount, "accountType">,
): boolean {
  return account.accountType === "reserve";
}

export function isAltaSavingsAccount(
  account: Pick<UserBankAccount, "accountType" | "accountName" | "name" | "product">,
): boolean {
  return account.accountType === "savings" && !isRetailAltaMoneyMarketAccount(account);
}

/** Savings card: Alta Savings + Reserve Account. */
export function countsTowardSavingsCard(
  account: Pick<UserBankAccount, "accountType" | "accountName" | "name" | "product">,
): boolean {
  return isAltaSavingsAccount(account) || isReserveAccount(account);
}

/** Money market card: Summit + retail Alta Money Market. */
export function countsTowardMoneyMarketCard(
  account: Pick<UserBankAccount, "accountType" | "accountName" | "name" | "product">,
): boolean {
  return isSummitMoneyMarketAccount(account) || isRetailAltaMoneyMarketAccount(account);
}

export type BankBalanceStripBalances = Pick<
  UserBankDashboard,
  "checkingBalance" | "savingsBalance" | "moneyMarketBalance" | "businessBalance"
>;

/** Balance strip: checking → savings → money market → business. */
export function buildBankBalanceStripItems<T>(
  balances: BankBalanceStripBalances,
  formatValue: (amount: number) => T,
): { label: string; value: T }[] {
  return [
    { label: "Checking", value: formatValue(balances.checkingBalance) },
    { label: "Savings", value: formatValue(balances.savingsBalance) },
    { label: "Money market", value: formatValue(balances.moneyMarketBalance) },
    { label: "Business", value: formatValue(balances.businessBalance) },
  ];
}
