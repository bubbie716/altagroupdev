export interface LoanRepaymentProgress {
  amountRepaid: number;
  percentRepaid: number;
  totalRepaymentObligation: number;
  nextPaymentDueLabel: string;
  includesAccruedInterest: boolean;
}

export function computeLoanRepaymentProgress(
  principalAmount: number,
  outstandingBalance: number,
  totalPaymentsCompleted = 0,
): LoanRepaymentProgress {
  const amountRepaid =
    totalPaymentsCompleted > 0
      ? totalPaymentsCompleted
      : Math.max(0, principalAmount - outstandingBalance);
  const totalRepaymentObligation = amountRepaid + outstandingBalance;
  const rawPercent =
    totalRepaymentObligation > 0 ? (amountRepaid / totalRepaymentObligation) * 100 : 0;
  const percentRepaid = Math.min(100, Math.max(0, rawPercent));

  return {
    amountRepaid,
    percentRepaid,
    totalRepaymentObligation,
    nextPaymentDueLabel: "See payment schedule",
    includesAccruedInterest: totalRepaymentObligation > principalAmount,
  };
}

export const CREDIT_PROFILE_PLACEHOLDERS = [
  { label: "Estimated Net Worth", note: "Requires Terminal portfolio integration" },
  { label: "Bank Cash", note: "Not available yet" },
  { label: "Investment Value", note: "Requires Terminal portfolio integration" },
  { label: "Alta Credit Score", note: "Not available yet" },
  { label: "Pre-Approved Credit", note: "Not available yet" },
] as const;
