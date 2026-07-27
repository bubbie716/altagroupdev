import type { MerchantInvoiceRecipientOption } from "@/lib/bank/merchant-invoice-types";

export type InvoiceWizardStep = "recipient" | "details" | "review";

export type InvoiceFormValues = {
  amount: string;
  description: string;
  memo: string;
  dueDate: string;
};

export type RecipientSearchStatus =
  | "idle"
  | "loading"
  | "results"
  | "no-results"
  | "search-error"
  | "selected";

/**
 * Pure resolver for recipient search UI states.
 * "unavailable" recipients remain in results with canReceive=false — callers render them disabled.
 */
export function resolveRecipientSearchStatus(input: {
  query: string;
  loading: boolean;
  searchError: boolean;
  results: readonly unknown[];
  selected: unknown | null;
}): RecipientSearchStatus {
  if (input.selected) return "selected";
  const q = input.query.trim();
  if (q.length < 1) return "idle";
  if (input.loading) return "loading";
  if (input.searchError) return "search-error";
  if (input.results.length === 0) return "no-results";
  return "results";
}

/** Start-of-local-day for date-only inputs (YYYY-MM-DD). */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Optional due date: empty is ok; invalid or past calendar dates are rejected.
 */
export function validateInvoiceDueDate(
  dueDate: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (dueDate == null || !String(dueDate).trim()) return null;
  const trimmed = String(dueDate).trim();
  // Prefer YYYY-MM-DD from <input type="date">
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let parsed: Date;
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    parsed = new Date(year, month, day);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month ||
      parsed.getDate() !== day
    ) {
      return "Enter a valid due date.";
    }
  } else {
    parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return "Enter a valid due date.";
  }
  if (startOfLocalDay(parsed).getTime() < startOfLocalDay(now).getTime()) {
    return "Due date cannot be in the past.";
  }
  return null;
}

export function validateInvoiceRecipient(
  recipient: MerchantInvoiceRecipientOption | null,
): string | null {
  if (!recipient) return "Select a customer or company to invoice.";
  if (!recipient.canReceive) return "This recipient cannot receive invoices right now.";
  return null;
}

export function validateInvoiceDetails(values: InvoiceFormValues): string | null {
  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a valid invoice amount.";
  if (!values.description.trim()) return "Description is required.";
  return validateInvoiceDueDate(values.dueDate);
}

export function isInvoiceFormDirty(input: {
  values: InvoiceFormValues;
  initial: InvoiceFormValues;
  hasSelectedRecipient: boolean;
  initialHadRecipient: boolean;
}): boolean {
  if (input.hasSelectedRecipient !== input.initialHadRecipient) return true;
  const { values, initial } = input;
  return (
    values.amount !== initial.amount ||
    values.description !== initial.description ||
    values.memo !== initial.memo ||
    values.dueDate !== initial.dueDate
  );
}

export const EMPTY_INVOICE_FORM: InvoiceFormValues = {
  amount: "",
  description: "",
  memo: "",
  dueDate: "",
};
