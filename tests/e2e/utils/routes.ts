/** Static Alta Bank customer routes (no dynamic params). */
export const BANK_STATIC_ROUTES = [
  "/bank",
  "/bank/dashboard",
  "/bank/deposit",
  "/bank/withdraw",
  "/bank/transfers",
  "/bank/transfers/intrabank",
  "/bank/transfers/interbank",
  "/bank/pay",
  "/bank/statements",
  "/bank/products",
  "/bank/deposits",
  "/bank/open",
  "/bank/accounts",
  "/bank/private",
  "/bank/lending",
  "/bank/lending/apply",
  "/bank/lending/applications",
  "/bank/lending/loans",
  "/bank/lending/deal-rooms",
  "/bank/alta-card",
  "/bank/alta-card/apply",
  "/bank/alta-card/business",
  "/bank/alta-card/business/apply",
  "/bank/business",
  "/bank/business/representatives",
  "/bank/business/statements",
  "/bank/business/payments",
  "/bank/business/payroll",
  "/bank/credit-desk-closed",
  "/profile",
] as const;

/** Static internal console routes. */
export const INTERNAL_STATIC_ROUTES = [
  "/internal",
  "/internal/settings",
  "/internal/audit",
  "/internal/reports",
  "/internal/jobs",
  "/internal/compliance",
  "/internal/exceptions",
  "/internal/embeds",
  "/internal/exchange",
  "/internal/listings",
  "/internal/ipos",
  "/internal/api-applications",
  "/internal/terminal",
  "/internal/users",
  "/internal/companies",
  "/internal/relationships",
  "/internal/bank",
  "/internal/bank/deposits",
  "/internal/bank/withdrawals",
  "/internal/bank/transfers",
  "/internal/bank/scheduled",
  "/internal/bank/statements",
  "/internal/bank/interest",
  "/internal/bank/accounts",
  "/internal/bank/transactions",
  "/internal/bank/alta-pay",
  "/internal/lending",
  "/internal/lending/deal-rooms",
  "/internal/alta-card",
  "/internal/alta-card/applications",
  "/internal/alta-card/reviews",
  "/internal/alta-card/cards",
  "/internal/queues/deposits",
  "/internal/queues/withdrawals",
  "/internal/queues/account-openings",
  "/internal/queues/company-verifications",
  "/internal/queues/lending-applications",
  "/internal/queues/alta-card-applications",
  "/internal/queues/alta-card-reviews",
  "/internal/queues/deal-rooms",
  "/internal/queues/exceptions",
  "/internal/queues/private-banking",
] as const;

export function bankAccountRoute(accountId: string): string {
  return `/bank/account/${accountId}`;
}

export function internalTransactionRoute(transactionId: string): string {
  return `/internal/bank/transactions/${transactionId}`;
}

export function internalUserRoute(userId: string): string {
  return `/internal/users/${userId}`;
}

export function internalCompanyRoute(companyId: string): string {
  return `/internal/companies/${companyId}`;
}
