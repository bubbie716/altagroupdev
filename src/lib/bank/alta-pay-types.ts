export interface PayableCompany {
  id: string;
  name: string;
  sector: string | null;
  ticker: string | null;
  verificationStatus: "verified";
  destinationAccountName: string;
  destinationLabel: string;
}

export type AltaPayFundingSource =
  | { kind: "bank_account"; accountId: string }
  | { kind: "alta_card"; cardId: string };

export interface SubmitAltaPayInput {
  fundingSource: AltaPayFundingSource;
  companyId: string;
  amount: number;
  memo?: string;
}

export interface SubmitAltaPayResult {
  referenceCode: string;
  amount: number;
  companyName: string;
  fundingSourceLabel: string;
  cardTransactionId?: string;
}

export interface PayFundingSourceOption {
  kind: "bank_account" | "alta_card";
  id: string;
  label: string;
  detail: string;
  availableBalance: number;
  cardLastFour?: string;
}

export interface AltaPayPaymentRow {
  id: string;
  referenceCode: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  direction: "sent" | "received";
  payerLabel: string;
  payeeLabel: string;
  sourceAccountName: string | null;
  fundingSourceLabel: string;
}

export interface AltaPayReceivedSummary {
  totalThisMonth: number;
  paymentCountThisMonth: number;
  recentPayments: AltaPayPaymentRow[];
}

export interface AltaPayVolumeSummary {
  countThisMonth: number;
  volumeThisMonth: number;
}

/** Reference prefix for Alta Pay intrabank settlement pairs. */
export const ALTA_PAY_REFERENCE_PREFIX = "PAY-";
