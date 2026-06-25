export type PaginatedResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type GlobalSearchResultType =
  | "user"
  | "company"
  | "account"
  | "transaction"
  | "loan"
  | "statement"
  | "alta_pay";

export type GlobalSearchResult = {
  id: string;
  type: GlobalSearchResultType;
  label: string;
  sublabel: string;
  href: string;
};

export type OpsHealthItem = {
  key: string;
  label: string;
  status: "operational" | "degraded" | "unknown";
  detail: string;
  lastSuccessAt: string | null;
};

export type ExceptionItem = {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium";
  title: string;
  detail: string;
  href: string;
  amount?: number;
  createdAt: string;
};

export type ActivityFeedItem = {
  id: string;
  category: string;
  title: string;
  detail: string;
  accountLabel: string | null;
  accountId: string | null;
  href: string | null;
  actorLabel: string | null;
  createdAt: string;
};

export type OpsReportRow = {
  label: string;
  count: number;
  totalAmount: number;
};

export type TimelineEvent = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  actorLabel: string | null;
  createdAt: string;
  href: string | null;
  accountLabel: string | null;
  accountId: string | null;
};

export type TransactionExplorerRow = {
  id: string;
  referenceCode: string;
  type: string;
  status: string;
  amount: number;
  accountNumber: string;
  holder: string;
  description: string;
  createdAt: string;
};

export type TransactionDetail = TransactionExplorerRow & {
  accountId: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
  memo: string | null;
  reviewNote: string | null;
  reviewedByLabel: string | null;
  reviewedAt: string | null;
  proofImageUrl: string | null;
  linkedTransactions: TransactionExplorerRow[];
  relatedLoanId: string | null;
  relatedAltaPayRef: string | null;
  relatedStatementId: string | null;
};

export type AltaPayAdminRow = {
  referenceCode: string;
  amount: number;
  payerLabel: string;
  payerAccountNumber: string;
  merchantName: string;
  merchantAccountNumber: string;
  status: string;
  memo: string | null;
  createdAt: string;
  outTransactionId: string;
  inTransactionId: string;
};
