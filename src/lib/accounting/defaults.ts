export const DEFAULT_EXPENSE_CATEGORIES = [
  "Supplies",
  "Inventory",
  "Shipping",
  "Fees",
  "Software",
  "Ads/Marketing",
  "Gas/Mileage",
  "Meals",
  "Rent",
  "Utilities",
  "Other Expense",
] as const;

export const DEFAULT_INCOME_CATEGORIES = ["Sales", "Services", "Other Income"] as const;

export const ACCOUNTING_PAYMENT_METHODS = [
  "cash",
  "card",
  "bank",
  "check",
  "other",
] as const;

export type AccountingPaymentMethod = (typeof ACCOUNTING_PAYMENT_METHODS)[number];

export const ACCOUNTING_ENTRY_TYPES = ["income", "expense"] as const;
export type AccountingEntryType = (typeof ACCOUNTING_ENTRY_TYPES)[number];

export const ACCOUNTING_CATEGORY_KINDS = ["income", "expense", "both"] as const;
export type AccountingCategoryKind = (typeof ACCOUNTING_CATEGORY_KINDS)[number];

export const ACCOUNTING_COUNTERPARTY_KINDS = ["customer", "vendor", "both"] as const;
export type AccountingCounterpartyKind = (typeof ACCOUNTING_COUNTERPARTY_KINDS)[number];
