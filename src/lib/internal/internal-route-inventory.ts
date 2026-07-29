/**
 * Authoritative classification of every route under `src/routes/internal`.
 * New route files must be added here — Phase 8 inventory test enforces coverage.
 */

export type InternalRouteClass =
  | "canonical_visible"
  | "dynamic_canonical_record"
  | "compatibility_redirect"
  | "intentionally_unavailable"
  | "layout_only";

export type InternalRouteInventoryEntry = {
  /** Path relative to src/routes/internal/ */
  file: string;
  classification: InternalRouteClass;
  /** Human note for operators/engineers. */
  note?: string;
};

/** Every `.tsx` file under src/routes/internal must appear exactly once. */
export const INTERNAL_ROUTE_INVENTORY: InternalRouteInventoryEntry[] = [
  { file: "route.tsx", classification: "layout_only", note: "Internal shell layout" },
  { file: "index.tsx", classification: "canonical_visible", note: "Corporate Home" },
  { file: "inbox.tsx", classification: "canonical_visible" },
  { file: "users/index.tsx", classification: "canonical_visible", note: "People" },
  { file: "users/$userId.tsx", classification: "dynamic_canonical_record" },
  { file: "companies/index.tsx", classification: "canonical_visible" },
  { file: "companies/$companyId.tsx", classification: "dynamic_canonical_record" },
  {
    file: "companies/$companyId/relationship.tsx",
    classification: "compatibility_redirect",
    note: "→ company workspace relationship section",
  },
  { file: "relationships/index.tsx", classification: "canonical_visible" },
  {
    file: "relationships/$userId.tsx",
    classification: "compatibility_redirect",
    note: "→ customer workspace relationship section",
  },
  { file: "bank/route.tsx", classification: "layout_only" },
  { file: "bank/index.tsx", classification: "canonical_visible", note: "Bank Home" },
  { file: "bank/accounts/index.tsx", classification: "canonical_visible" },
  { file: "bank/accounts/$accountId.tsx", classification: "dynamic_canonical_record" },
  { file: "bank/transactions/index.tsx", classification: "canonical_visible" },
  { file: "bank/transactions/$transactionId.tsx", classification: "dynamic_canonical_record" },
  { file: "bank/transfers/index.tsx", classification: "canonical_visible" },
  { file: "bank/transfers/$transferId.tsx", classification: "dynamic_canonical_record" },
  { file: "bank/alta-pay/index.tsx", classification: "canonical_visible" },
  { file: "bank/alta-pay/$referenceCode.tsx", classification: "dynamic_canonical_record" },
  { file: "bank/alta-pay/invoices/$invoiceId.tsx", classification: "dynamic_canonical_record" },
  { file: "bank/alta-pay/payment-links/$linkId.tsx", classification: "dynamic_canonical_record" },
  { file: "bank/statements.tsx", classification: "canonical_visible" },
  { file: "bank/interest.tsx", classification: "canonical_visible" },
  { file: "bank/settings.tsx", classification: "canonical_visible" },
  {
    file: "bank/scheduled.tsx",
    classification: "compatibility_redirect",
    note: "→ Transfers?status=scheduled",
  },
  {
    file: "bank/deposits.tsx",
    classification: "compatibility_redirect",
    note: "→ queues/deposits → Inbox",
  },
  {
    file: "bank/withdrawals.tsx",
    classification: "compatibility_redirect",
    note: "→ queues/withdrawals → Inbox",
  },
  { file: "lending/route.tsx", classification: "layout_only" },
  { file: "lending/index.tsx", classification: "canonical_visible" },
  { file: "lending/loans/index.tsx", classification: "canonical_visible" },
  { file: "lending/loans/$loanId.tsx", classification: "dynamic_canonical_record" },
  {
    file: "lending/applications/$applicationId/index.tsx",
    classification: "dynamic_canonical_record",
  },
  {
    file: "lending/applications/$applicationId/thread.tsx",
    classification: "compatibility_redirect",
  },
  {
    file: "lending/deal-rooms/route.tsx",
    classification: "layout_only",
  },
  {
    file: "lending/deal-rooms/index.tsx",
    classification: "compatibility_redirect",
    note: "→ /internal/lending",
  },
  {
    file: "lending/deal-rooms/$dealRoomId.tsx",
    classification: "compatibility_redirect",
  },
  { file: "alta-card/index.tsx", classification: "canonical_visible" },
  { file: "alta-card/cards/index.tsx", classification: "canonical_visible" },
  { file: "alta-card/$cardId.tsx", classification: "dynamic_canonical_record" },
  {
    file: "alta-card/applications/index.tsx",
    classification: "compatibility_redirect",
  },
  {
    file: "alta-card/applications/$applicationId/route.tsx",
    classification: "layout_only",
  },
  {
    file: "alta-card/applications/$applicationId/index.tsx",
    classification: "dynamic_canonical_record",
  },
  {
    file: "alta-card/applications/$applicationId/thread.tsx",
    classification: "compatibility_redirect",
  },
  {
    file: "alta-card/reviews/index.tsx",
    classification: "compatibility_redirect",
  },
  {
    file: "alta-card/reviews/$reviewId/index.tsx",
    classification: "dynamic_canonical_record",
  },
  {
    file: "alta-card/reviews/$reviewId/thread.tsx",
    classification: "compatibility_redirect",
  },
  { file: "jobs.tsx", classification: "canonical_visible" },
  { file: "audit.tsx", classification: "canonical_visible" },
  { file: "reports.tsx", classification: "canonical_visible" },
  { file: "compliance.tsx", classification: "canonical_visible", note: "Risk" },
  { file: "settings.tsx", classification: "canonical_visible" },
  { file: "embeds.tsx", classification: "canonical_visible", note: "Communications" },
  { file: "terminal.tsx", classification: "layout_only" },
  { file: "terminal/inbox.tsx", classification: "canonical_visible" },
  { file: "terminal/investors/index.tsx", classification: "canonical_visible" },
  { file: "terminal/portfolios/index.tsx", classification: "canonical_visible" },
  { file: "terminal/portfolios/$portfolioId.tsx", classification: "dynamic_canonical_record" },
  { file: "terminal/orders/index.tsx", classification: "canonical_visible" },
  { file: "terminal/orders/$orderId.tsx", classification: "dynamic_canonical_record" },
  { file: "terminal/system.tsx", classification: "canonical_visible" },
  { file: "terminal/settings.tsx", classification: "canonical_visible" },
  { file: "exchange.tsx", classification: "layout_only", note: "Legacy host layout" },
  { file: "exchange/settings.tsx", classification: "canonical_visible" },
  {
    file: "queues/deposits.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/withdrawals.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/exceptions.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/account-openings.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/lending-applications.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/alta-card-applications.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/alta-card-reviews.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/company-verifications.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "queues/deal-rooms.tsx",
    classification: "compatibility_redirect",
    note: "→ Inbox",
  },
  {
    file: "exceptions.tsx",
    classification: "compatibility_redirect",
    note: "→ queues/exceptions → Inbox",
  },
  {
    file: "listings.tsx",
    classification: "intentionally_unavailable",
    note: "Redirects home — Exchange listings retired",
  },
  {
    file: "ipos.tsx",
    classification: "intentionally_unavailable",
    note: "Redirects home — Exchange IPOs retired",
  },
];

export const CANONICAL_VISIBLE_PATHS = [
  "/internal",
  "/internal/inbox",
  "/internal/users",
  "/internal/companies",
  "/internal/relationships",
  "/internal/bank",
  "/internal/bank/accounts",
  "/internal/bank/transactions",
  "/internal/bank/transfers",
  "/internal/bank/alta-pay",
  "/internal/bank/statements",
  "/internal/bank/interest",
  "/internal/bank/settings",
  "/internal/lending",
  "/internal/lending/loans",
  "/internal/alta-card",
  "/internal/alta-card/cards",
  "/internal/jobs",
  "/internal/audit",
  "/internal/reports",
  "/internal/compliance",
  "/internal/settings",
  "/internal/embeds",
  "/internal/terminal/inbox",
  "/internal/terminal/investors",
  "/internal/terminal/portfolios",
  "/internal/terminal/orders",
  "/internal/terminal/system",
  "/internal/terminal/settings",
] as const;
