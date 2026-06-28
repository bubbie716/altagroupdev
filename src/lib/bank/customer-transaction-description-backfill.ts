import type {
  BankAccountType,
  BankTransactionStatus,
  BankTransactionType,
} from "@prisma/client";
import { formatBankAccountTypeLabel } from "@/lib/bank/backend-types";
import {
  type InterestPaymentBasis,
  accountInterestPaymentDescription,
  altaCardAdjustmentDescription,
  altaCardCashAdvanceBankDescription,
  altaCardCashAdvanceCardDescription,
  altaCardFeeCreditDescription,
  altaCardInterestChargeDescription,
  altaCardLateFeeDescription,
  altaCardPaymentDescription,
  altaCardReversalDescription,
  altaPayFromDescription,
  altaPayReversalDescription,
  altaPayToDescription,
  creditAdjustmentDescription,
  debitAdjustmentDescription,
  DEPOSIT_APPROVED_DESCRIPTION,
  DEPOSIT_DECLINED_DESCRIPTION,
  DEPOSIT_PENDING_DESCRIPTION,
  loanInterestChargePaymentDescription,
  LOAN_ADJUSTMENT_DESCRIPTION,
  LOAN_FUNDING_DESCRIPTION,
  LOAN_INTEREST_CHARGE_DESCRIPTION,
  LOAN_PAYMENT_DESCRIPTION,
  LOAN_PAYOFF_DESCRIPTION,
  normalizeTransactionDescriptionSeparators,
  reversalAdjustmentDescription,
  stripAltaPayFromPrefix,
  stripAltaPayToPrefix,
  transferFromDescription,
  transferToDescription,
  TX_DESC_SEP,
  type TransferDescriptionScope,
  WITHDRAWAL_APPROVED_DESCRIPTION,
  WITHDRAWAL_DECLINED_DESCRIPTION,
  WITHDRAWAL_PENDING_DESCRIPTION,
} from "@/lib/bank/customer-transaction-copy";
import { fromDbBankAccountType } from "@/server/bank-mapper";

export type BankTransactionBackfillRow = {
  type: BankTransactionType;
  status: BankTransactionStatus;
  description: string;
  referenceCode: string;
  bankAccount: { accountType: BankAccountType; accountName: string };
};

export type AltaCardTransactionBackfillRow = {
  description: string;
  type: string;
  altaCard: { cardLastFour: string };
  altaEmployeeCard?: { cardLastFour: string } | null;
  metadata: unknown;
};

function accountTypeLabel(accountType: BankAccountType): string {
  return formatBankAccountTypeLabel(fromDbBankAccountType(accountType));
}

function cardLastFour(row: AltaCardTransactionBackfillRow): string {
  return row.altaEmployeeCard?.cardLastFour ?? row.altaCard.cardLastFour;
}

function parseTransfer(
  description: string,
  direction: "to" | "from",
): { counterparty: string; scope: TransferDescriptionScope } | null {
  const withSuffix = new RegExp(
    `^(Intrabank|Interbank|Operator) transfer ${direction} (.+?) · `,
  );
  const matchWithSuffix = description.match(withSuffix);
  if (matchWithSuffix) {
    const scope: TransferDescriptionScope =
      matchWithSuffix[1].toLowerCase() === "interbank" ? "interbank" : "intrabank";
    return { counterparty: matchWithSuffix[2].trim(), scope };
  }

  const plain = new RegExp(`^(Intrabank|Interbank) transfer ${direction} (.+)$`);
  const matchPlain = description.match(plain);
  if (matchPlain) {
    const scope: TransferDescriptionScope =
      matchPlain[1].toLowerCase() === "interbank" ? "interbank" : "intrabank";
    return { counterparty: matchPlain[2].trim(), scope };
  }

  const privateTransfer = new RegExp(
    `^Alta Private access ended — transfer ${direction} (.+?) · `,
  );
  const matchPrivate = description.match(privateTransfer);
  if (matchPrivate) {
    return { counterparty: matchPrivate[1].trim(), scope: "intrabank" };
  }

  const generic = new RegExp(`^Transfer ${direction} (.+)$`);
  const matchGeneric = description.match(generic);
  if (matchGeneric) {
    return { counterparty: matchGeneric[1].trim(), scope: "intrabank" };
  }

  return null;
}

export function parseAdminAdjustmentReason(description: string): {
  direction: "credit" | "debit";
  reason: string;
} | null {
  const credit = description.match(/^Admin credit — (.+)$/i);
  if (credit) return { direction: "credit", reason: credit[1] };
  const debit = description.match(/^Admin debit — (.+)$/i);
  if (debit) return { direction: "debit", reason: debit[1] };
  return null;
}

export function parseReversalOfReference(reason: string): string | null {
  const match = reason.match(/^Reversal of ([A-Z0-9-]+):/i);
  return match?.[1] ?? null;
}

function interestPaymentDescription(
  accountType: BankAccountType,
  basis?: InterestPaymentBasis,
): string {
  return accountInterestPaymentDescription(accountTypeLabel(accountType), basis);
}

function rewriteInterestPaymentDescription(
  tx: BankTransactionBackfillRow,
  description: string,
  basis?: InterestPaymentBasis,
): string | null {
  if (tx.type !== "INTEREST_CREDIT") return null;

  const label = accountTypeLabel(tx.bankAccount.accountType);
  if (
    description === "Interest credit" ||
    description.startsWith("Manual Interest Credit —") ||
    /^.+ Interest Payment((?: · |\. ).+)?$/.test(description)
  ) {
    const next = accountInterestPaymentDescription(label, basis);
    return next !== description ? next : null;
  }

  return null;
}

export function rewriteBankTransactionDescription(
  tx: BankTransactionBackfillRow,
  options?: {
    resolveDescriptionByReference?: (referenceCode: string) => string | null;
    resolveAltaPayMerchantByPaymentRef?: (paymentRef: string) => string | null;
    resolveInterestPaymentBasis?: () => InterestPaymentBasis | null;
  },
): string | null {
  const { description: d, type, status } = tx;

  if (type === "DEPOSIT") {
    if (
      d === "Deposit request" ||
      d === DEPOSIT_PENDING_DESCRIPTION ||
      d === "Deposit — Pending Review"
    ) {
      if (status === "APPROVED") return DEPOSIT_APPROVED_DESCRIPTION;
      if (status === "PENDING") return DEPOSIT_PENDING_DESCRIPTION;
      if (status === "DENIED") return DEPOSIT_DECLINED_DESCRIPTION;
    }
    if (d === "Deposit — Declined") return DEPOSIT_DECLINED_DESCRIPTION;
  }

  if (type === "WITHDRAWAL") {
    if (
      d === "Withdrawal request" ||
      d === WITHDRAWAL_PENDING_DESCRIPTION ||
      d === "Withdrawal — Pending Review"
    ) {
      if (status === "APPROVED") return WITHDRAWAL_APPROVED_DESCRIPTION;
      if (status === "PENDING") return WITHDRAWAL_PENDING_DESCRIPTION;
      if (status === "DENIED") return WITHDRAWAL_DECLINED_DESCRIPTION;
    }
    if (d === "Withdrawal — Declined") return WITHDRAWAL_DECLINED_DESCRIPTION;
  }

  const transferTo = parseTransfer(d, "to");
  if (transferTo) {
    const next = transferToDescription(transferTo.counterparty, transferTo.scope);
    if (next !== d) return next;
  }

  const transferFrom = parseTransfer(d, "from");
  if (transferFrom) {
    const next = transferFromDescription(transferFrom.counterparty, transferFrom.scope);
    if (next !== d) return next;
  }

  if (d === "Interest credit") {
    return interestPaymentDescription(
      tx.bankAccount.accountType,
      options?.resolveInterestPaymentBasis?.() ?? undefined,
    );
  }

  if (d.startsWith("Manual Interest Credit —")) {
    return interestPaymentDescription(
      tx.bankAccount.accountType,
      options?.resolveInterestPaymentBasis?.() ?? undefined,
    );
  }

  const interestPayment = rewriteInterestPaymentDescription(
    tx,
    d,
    options?.resolveInterestPaymentBasis?.() ?? undefined,
  );
  if (interestPayment) return interestPayment;

  const altaPayTo = d.match(/^Alta Pay business payment to (.+)$/);
  if (altaPayTo) return altaPayToDescription(altaPayTo[1]);

  const altaPayFrom = d.match(/^Alta Pay business payment from (.+?)(?: \(Alta Card\))?$/);
  if (altaPayFrom) return altaPayFromDescription(altaPayFrom[1]);

  if (d.startsWith("Alta Pay to ")) {
    const name = stripAltaPayToPrefix(d);
    if (name !== d && d !== altaPayToDescription(name)) return altaPayToDescription(name);
  }

  if (d.startsWith("Alta Pay from ") || d.startsWith("Alta Pay business payment from ")) {
    const name = stripAltaPayFromPrefix(d);
    if (name !== d && d !== altaPayFromDescription(name)) return altaPayFromDescription(name);
  }

  const altaPayReversal = d.match(/^Alta Pay reversal(?: credit)? · (.+)$/);
  if (altaPayReversal) {
    const merchant =
      options?.resolveAltaPayMerchantByPaymentRef?.(altaPayReversal[1]) ?? altaPayReversal[1];
    const next = altaPayReversalDescription(merchant);
    if (next !== d) return next;
  }

  if (/^Loan payment · [a-z0-9]+$/i.test(d)) return LOAN_PAYMENT_DESCRIPTION;
  if (/^Loan disbursement · [a-z0-9]+$/i.test(d)) return LOAN_FUNDING_DESCRIPTION;
  if (/^Loan funding · Agreement /i.test(d)) return LOAN_FUNDING_DESCRIPTION;

  const admin = parseAdminAdjustmentReason(d);
  if (admin) {
    const reversalRef = parseReversalOfReference(admin.reason);
    if (reversalRef && options?.resolveDescriptionByReference) {
      const original = options.resolveDescriptionByReference(reversalRef);
      if (original) {
        const rewritten =
          rewriteBankTransactionDescription(
            { ...tx, description: original },
            options,
          ) ?? original;
        return reversalAdjustmentDescription(rewritten);
      }
    }
    const next =
      admin.direction === "credit"
        ? creditAdjustmentDescription(admin.reason)
        : debitAdjustmentDescription(admin.reason);
    if (next !== d) return next;
  }

  const cardPayment = d.match(/^Alta Card payment · •••• (\d{4})$/);
  if (cardPayment) return altaCardPaymentDescription(cardPayment[1]);

  const cardAutopay = d.match(/^Alta Card autopay · •••• (\d{4})$/);
  if (cardAutopay) return altaCardPaymentDescription(cardAutopay[1]);

  const cardCashAdvance = d.match(/^Alta Card cash advance · •••• (\d{4})$/);
  if (cardCashAdvance) return altaCardCashAdvanceBankDescription(cardCashAdvance[1]);

  const employeeCashAdvance = d.match(
    /^Alta Card employee cash advance · .+ · •••• (\d{4})$/,
  );
  if (employeeCashAdvance) return altaCardCashAdvanceBankDescription(employeeCashAdvance[1]);

  return null;
}

export function rewriteAltaCardTransactionDescription(
  tx: AltaCardTransactionBackfillRow,
): string | null {
  const d = tx.description;
  const last4 = cardLastFour(tx);

  const altaPayBusiness = d.match(/^Alta Pay to (.+?) \(.+\)$/);
  if (altaPayBusiness) return altaPayToDescription(altaPayBusiness[1]);

  if (d.startsWith("Alta Pay to ")) {
    const name = stripAltaPayToPrefix(d);
    if (name !== d && d !== altaPayToDescription(name)) return altaPayToDescription(name);
  }

  if (/^Cash advance to .+$/i.test(d) || /^Employee cash advance to .+$/i.test(d)) {
    return altaCardCashAdvanceCardDescription(last4);
  }

  if (/^Payment from .+$/i.test(d) || /^Autopay from .+$/i.test(d)) {
    return altaCardPaymentDescription(last4);
  }

  if (/^Manual payment \(admin\):/i.test(d)) {
    return altaCardPaymentDescription(last4);
  }

  if (/^Admin adjustment:/i.test(d)) {
    return altaCardAdjustmentDescription(last4);
  }

  const interest = d.match(/^Interest on statement #(\d+)$/i);
  if (interest) return altaCardInterestChargeDescription(Number(interest[1]));

  const lateFee = d.match(/^Late payment fee — statement #(\d+)$/i);
  if (lateFee) return altaCardLateFeeDescription(Number(lateFee[1]));

  const feeWaiver = d.match(/^Fee waiver — (.+)$/i);
  if (feeWaiver) {
    const label = feeWaiver[1]
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    return altaCardFeeCreditDescription(label);
  }

  if (/^Manual fee — /i.test(d)) {
    return `Alta Card Fee${TX_DESC_SEP}•••• ${last4}`;
  }

  const reversal = d.match(/^Reversal: (.+?)(?: — .+)?$/i);
  if (reversal) {
    const inner = rewriteAltaCardTransactionDescription({
      ...tx,
      description: reversal[1],
    });
    const summary = inner ?? reversal[1];
    return altaCardReversalDescription(summary);
  }

  const cardPaymentLegacy = d.match(/^Alta Card payment · •••• (\d{4})$/i);
  if (cardPaymentLegacy) return altaCardPaymentDescription(cardPaymentLegacy[1]);

  return null;
}

export function rewriteLoanLedgerDescription(description: string): string | null {
  const exact: Record<string, string> = {
    "Automatic loan payment": LOAN_PAYMENT_DESCRIPTION,
    "Loan payment": LOAN_PAYMENT_DESCRIPTION,
    "Loan paid off": LOAN_PAYOFF_DESCRIPTION,
    "Principal disbursed to linked account": LOAN_FUNDING_DESCRIPTION,
    "Month 1 interest guaranteed at disbursement": LOAN_INTEREST_CHARGE_DESCRIPTION,
    "Month 1 interest guaranteed at funding": LOAN_INTEREST_CHARGE_DESCRIPTION,
    "Operator balance adjustment": LOAN_ADJUSTMENT_DESCRIPTION,
  };
  if (exact[description]) return exact[description];

  const guaranteedMatch = description.match(/^Interest guaranteed · month (\d+)$/i);
  if (guaranteedMatch) {
    return loanInterestChargePaymentDescription(Number(guaranteedMatch[1]));
  }

  if (description.startsWith("Loan receivable established")) {
    return LOAN_FUNDING_DESCRIPTION;
  }

  return null;
}
