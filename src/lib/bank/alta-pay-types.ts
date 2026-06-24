export interface PayableCompany {
  id: string;
  name: string;
  sector: string | null;
  ticker: string | null;
  verificationStatus: "verified";
  destinationAccountName: string;
  destinationLabel: string;
}

export interface SubmitAltaPayInput {
  fromAccountId: string;
  companyId: string;
  amount: number;
  memo?: string;
}

export interface SubmitAltaPayResult {
  referenceCode: string;
  amount: number;
  companyName: string;
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
