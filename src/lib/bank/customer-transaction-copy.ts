/** Customer-facing transaction description copy. Ops/audit logs may use internal language. */

/** Separates primary label from detail in activity descriptions (middle dot, not em dash or period). */
export const TX_DESC_SEP = " · ";

export const DEPOSIT_PENDING_DESCRIPTION = `Deposit${TX_DESC_SEP}Waiting on Alta`;
export const DEPOSIT_APPROVED_DESCRIPTION = "Deposit";
export const DEPOSIT_DECLINED_DESCRIPTION = `Deposit${TX_DESC_SEP}Declined`;
export const WITHDRAWAL_PENDING_DESCRIPTION = `Withdrawal${TX_DESC_SEP}Waiting on Alta`;
export const WITHDRAWAL_APPROVED_DESCRIPTION = "Withdrawal";
export const WITHDRAWAL_DECLINED_DESCRIPTION = `Withdrawal${TX_DESC_SEP}Declined`;

export type InterestPaymentBasis =
  | { mode: "percentage"; ratePercent: number }
  | { mode: "fixed" };

/** Human-readable percent for activity copy (e.g. 2 → "2%", 0.5 → "0.5%"). */
export function formatInterestPaymentRatePercent(ratePercent: number): string {
  const formatted =
    ratePercent % 1 === 0 ? ratePercent.toFixed(0) : ratePercent.toFixed(2).replace(/\.?0+$/, "");
  return `${formatted}%`;
}

/** Stored monthly decimal rate (e.g. 0.005) → display percent (0.5). */
export function monthlyDecimalRateToPercent(rate: number): number {
  return rate * 100;
}

export function accountInterestPaymentDescription(
  accountTypeLabel: string,
  basis?: InterestPaymentBasis,
): string {
  const base = `${accountTypeLabel} Interest Payment`;
  if (!basis) return base;
  const detail =
    basis.mode === "fixed"
      ? "Fixed amount"
      : formatInterestPaymentRatePercent(basis.ratePercent);
  return `${base}${TX_DESC_SEP}${detail}`;
}

export type TransferDescriptionScope = "intrabank" | "interbank";

function transferKindLabel(scope: TransferDescriptionScope): string {
  return scope === "interbank" ? "Interbank transfer" : "Intrabank transfer";
}

export function transferToDescription(
  accountName: string,
  scope: TransferDescriptionScope = "intrabank",
): string {
  return `${transferKindLabel(scope)} to ${accountName}`;
}

export function transferFromDescription(
  accountName: string,
  scope: TransferDescriptionScope = "intrabank",
): string {
  return `${transferKindLabel(scope)} from ${accountName}`;
}

export function altaPayToDescription(recipientName: string): string {
  return `Alta Pay to ${recipientName}`;
}

export function altaPayFromDescription(senderName: string): string {
  return `Alta Pay from ${senderName}`;
}

/** Strips Alta Pay payer-side prefix; supports legacy bank-leg wording. */
export function stripAltaPayToPrefix(description: string): string {
  return description.replace(/^Alta Pay (?:business payment )?to /, "");
}

/** Strips Alta Pay payee-side prefix; supports legacy bank-leg wording. */
export function stripAltaPayFromPrefix(description: string): string {
  return description
    .replace(/^Alta Pay (?:business payment )?from /, "")
    .replace(/ \(Alta Card\)$/, "");
}

export function altaCardPaymentDescription(lastFour: string): string {
  return `Alta Card Payment${TX_DESC_SEP}•••• ${lastFour}`;
}

export function altaCardCashAdvanceCardDescription(lastFour: string): string {
  return `Alta Card Cash Advance${TX_DESC_SEP}•••• ${lastFour}`;
}

export function altaCardCashAdvanceBankDescription(lastFour: string): string {
  return `Cash Advance from Alta Card •••• ${lastFour}`;
}

export function altaCardInterestChargeDescription(statementNumber: number): string {
  return `Alta Card Interest Charge${TX_DESC_SEP}Statement #${statementNumber}`;
}

export function altaCardLateFeeDescription(statementNumber: number): string {
  return `Alta Card Late Payment Fee${TX_DESC_SEP}Statement #${statementNumber}`;
}

export function altaCardFeeCreditDescription(feeTypeLabel: string): string {
  return `Alta Card Fee Credit${TX_DESC_SEP}${feeTypeLabel}`;
}

export function altaCardAdjustmentDescription(lastFour: string): string {
  return `Alta Card Adjustment${TX_DESC_SEP}•••• ${lastFour}`;
}

export function altaCardReversalDescription(originalSummary: string): string {
  return `Alta Card Reversal${TX_DESC_SEP}${originalSummary}`;
}

export function altaPayReversalDescription(counterpartyName: string): string {
  return `Alta Pay Reversal${TX_DESC_SEP}${counterpartyName}`;
}

export function formatAltaCardFeeTypeLabel(feeType: string): string {
  return feeType
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

export function creditAdjustmentDescription(reason: string): string {
  return `Credit Adjustment${TX_DESC_SEP}${reason}`;
}

export function debitAdjustmentDescription(reason: string): string {
  return `Debit Adjustment${TX_DESC_SEP}${reason}`;
}

export function reversalAdjustmentDescription(originalDescription: string): string {
  return `Reversal${TX_DESC_SEP}${originalDescription}`;
}

export function loanInterestChargePaymentDescription(installmentNumber: number): string {
  return `Loan Interest Charge${TX_DESC_SEP}Payment ${installmentNumber}`;
}

export function normalizeTransactionDescriptionSeparators(description: string): string {
  return description.replace(/ — /g, TX_DESC_SEP).replace(/\. /g, TX_DESC_SEP);
}

export const LOAN_FUNDING_DESCRIPTION = "Loan Funding";
export const LOAN_PAYMENT_DESCRIPTION = "Loan Payment";
export const LOAN_PAYOFF_DESCRIPTION = "Loan Payoff";
export const LOAN_ADJUSTMENT_DESCRIPTION = "Loan Adjustment";
export const LOAN_INTEREST_CHARGE_DESCRIPTION = "Loan Interest Charge";
