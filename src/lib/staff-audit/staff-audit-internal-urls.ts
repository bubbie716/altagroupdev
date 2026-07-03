export function internalUserUrl(userId: string): string {
  return `/internal/users/${userId}`;
}

export function internalCompanyUrl(companyId: string): string {
  return `/internal/companies/${companyId}`;
}

export function internalAccountUrl(accountId: string): string {
  return `/internal/bank/accounts/${accountId}`;
}

export function internalTransactionUrl(transactionId: string): string {
  return `/internal/bank/transactions/${transactionId}`;
}

export function internalDepositsQueueUrl(): string {
  return "/internal/queues/deposits";
}

export function internalWithdrawalsQueueUrl(): string {
  return "/internal/queues/withdrawals";
}

export function internalSettingsUrl(): string {
  return "/internal/settings";
}

export function internalJobsUrl(): string {
  return "/internal/jobs";
}

export function internalPrivateBankingQueueUrl(): string {
  return "/internal/queues/private-banking";
}

export function internalCompanyVerificationsQueueUrl(): string {
  return "/internal/queues/company-verifications";
}

export function internalAltaPayOpsUrl(): string {
  return "/internal/bank/alta-pay";
}

export function internalTransfersUrl(): string {
  return "/internal/bank/transfers";
}
