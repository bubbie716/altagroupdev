/**
 * Shared route and UI loading thresholds.
 *
 * TanStack Router defaults (if unset): pendingMs 1000, pendingMinMs 500.
 * We use 0 / 0 so navigation never waits on artificial timers.
 */
export const ROUTE_PENDING_MS = 0;
export const ROUTE_PENDING_MIN_MS = 0;

/** Debounce before typeahead / search requests (Alta Pay recipient lookup, etc.). */
export const SEARCH_DEBOUNCE_MS = 280;

/** Success / error card entrance — visual only, not a loading gate. */
export const FEEDBACK_ANIMATION_MS = 300;

/** Inline data fetch / panel bootstrap. */
export const LOADING_COPY = {
  default: "Loading…",
  route: "Loading…",
  autopay: "Loading autopay settings…",
  paymentOptions: "Loading payment options…",
  cashAdvanceOptions: "Loading cash advance options…",
  loanPaymentOptions: "Loading payment options…",
  commercialUpgrade: "Loading upgrade options…",
  commercialDowngrade: "Loading downgrade details…",
  paymentQuote: "Loading quote…",
  branding: "Loading branding…",
} as const;

/** Button / form submission in progress. */
export const SUBMITTING_COPY = {
  default: "Submitting…",
  processing: "Processing…",
  working: "Working…",
  uploading: "Uploading…",
  creating: "Creating…",
  cancelling: "Cancelling…",
  deleting: "Deleting…",
  saving: "Saving…",
  savingDraft: "Saving draft…",
  generating: "Generating…",
  generatingPdf: "Generating PDF…",
  opening: "Opening…",
  applying: "Applying…",
  updating: "Updating…",
  registering: "Registering…",
  sending: "Sending…",
  revoking: "Revoking…",
  signingIn: "Signing in…",
  previewing: "Previewing…",
  running: "Running…",
  refreshing: "Refreshing…",
  exporting: "Exporting…",
  backfilling: "Backfilling…",
  logging: "Logging…",
  scheduling: "Scheduling…",
  deactivating: "Deactivating…",
  accepting: "Accepting…",
  declining: "Declining…",
  accruing: "Accruing…",
  pausing: "Pausing…",
  activating: "Activating…",
  sendingInvoice: "Sending invoice…",
  sendingReminder: "Sending reminder…",
  creatingLink: "Creating link…",
  transferringFunds: "Transferring Funds…",
  submittingDeposit: "Submitting Deposit…",
  submittingWithdrawal: "Submitting Withdrawal…",
  processingPayment: "Processing Payment…",
  processingCashAdvance: "Processing Cash Advance…",
  processingUpgrade: "Processing Upgrade…",
  processingDowngrade: "Processing Downgrade…",
} as const;

export type LoadingCopyKey = keyof typeof LOADING_COPY;
export type SubmittingCopyKey = keyof typeof SUBMITTING_COPY;
