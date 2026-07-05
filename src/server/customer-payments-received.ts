import { stripAltaPayFromPrefix, stripAltaPayToPrefix } from "@/lib/bank/customer-transaction-copy";
import { ALTA_PAY_REFERENCE_PREFIX } from "@/lib/bank/alta-pay-types";
import { MERCHANT_INVOICE_PAY_REFERENCE_PREFIX } from "@/lib/bank/merchant-invoice-types";
import { PAYMENT_LINK_PAY_REFERENCE_PREFIX } from "@/lib/bank/payment-link-types";

export function extractReceivedCustomerPayerLabel(description: string): string {
  const altaPayLabel = stripAltaPayFromPrefix(description);
  if (altaPayLabel !== description) return altaPayLabel;

  const invoiceMatch = description.match(/^Merchant invoice payment from (.+)$/);
  if (invoiceMatch) return invoiceMatch[1];

  const paymentLinkMatch = description.match(/^Payment link from (.+)$/);
  if (paymentLinkMatch) return paymentLinkMatch[1];

  return description;
}

export function extractSentCustomerPayeeLabel(description: string): string {
  const altaPayLabel = stripAltaPayToPrefix(description);
  if (altaPayLabel !== description) return altaPayLabel;

  const invoiceMatch = description.match(/^Merchant invoice payment to (.+)$/);
  if (invoiceMatch) return invoiceMatch[1];

  const paymentLinkMatch = description.match(/^Payment link to (.+)$/);
  if (paymentLinkMatch) return paymentLinkMatch[1];

  return description;
}

export const ALTA_PAY_RECEIVED_DEPOSIT_FILTER = {
  referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-IN" as const },
};

export const ALTA_PAY_SENT_WITHDRAWAL_FILTER = {
  referenceCode: { startsWith: ALTA_PAY_REFERENCE_PREFIX, endsWith: "-OUT" as const },
};

export const CUSTOMER_RECEIVED_DEPOSIT_REFERENCE_FILTERS = [
  ALTA_PAY_RECEIVED_DEPOSIT_FILTER,
  {
    referenceCode: { startsWith: MERCHANT_INVOICE_PAY_REFERENCE_PREFIX, endsWith: "-IN" as const },
  },
  { referenceCode: { startsWith: PAYMENT_LINK_PAY_REFERENCE_PREFIX, endsWith: "-IN" as const } },
];

export const CUSTOMER_SENT_WITHDRAWAL_REFERENCE_FILTERS = [
  ALTA_PAY_SENT_WITHDRAWAL_FILTER,
  {
    referenceCode: { startsWith: MERCHANT_INVOICE_PAY_REFERENCE_PREFIX, endsWith: "-OUT" as const },
  },
  { referenceCode: { startsWith: PAYMENT_LINK_PAY_REFERENCE_PREFIX, endsWith: "-OUT" as const } },
];
