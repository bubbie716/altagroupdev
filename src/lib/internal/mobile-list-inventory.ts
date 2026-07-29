/**
 * Mobile list representation inventory — which component supplies cards vs tables.
 * Phase 8 layout tests assert each canonical list has a mobile card pattern.
 */

export type MobileListRepresentation = {
  /** Canonical path or route file */
  surface: string;
  /** Source file providing the list UI */
  source: string;
  /** Pattern that must appear for mobile cards */
  mobilePattern: RegExp;
  /** Desktop table pattern */
  desktopPattern: RegExp;
};

export const MOBILE_LIST_INVENTORY: MobileListRepresentation[] = [
  {
    surface: "People",
    source: "routes/internal/users/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /hidden(?:\s[\w/-]+)*\smd:block|<table/,
  },
  {
    surface: "Companies",
    source: "routes/internal/companies/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /<table/,
  },
  {
    surface: "Relationships",
    source: "routes/internal/relationships/index.tsx",
    mobilePattern: /space-y-3 md:hidden/,
    desktopPattern: /hidden overflow-x-auto md:block/,
  },
  {
    surface: "Accounts",
    source: "routes/internal/bank/accounts/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /<table/,
  },
  {
    surface: "Transactions",
    source: "routes/internal/bank/transactions/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /<table/,
  },
  {
    surface: "Transfers",
    source: "routes/internal/bank/transfers/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /<table/,
  },
  {
    surface: "Loans",
    source: "routes/internal/lending/loans/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /<table/,
  },
  {
    surface: "Cards",
    source: "routes/internal/alta-card/cards/index.tsx",
    mobilePattern: /md:hidden|space-y-3 md:hidden/,
    desktopPattern: /<table/,
  },
  {
    surface: "Terminal Investors",
    source: "routes/internal/terminal/investors/index.tsx",
    mobilePattern: /space-y-3 md:hidden/,
    desktopPattern: /hidden overflow-x-auto md:block/,
  },
  {
    surface: "Terminal Portfolios",
    source: "routes/internal/terminal/portfolios/index.tsx",
    mobilePattern: /space-y-3 md:hidden/,
    desktopPattern: /hidden overflow-x-auto md:block/,
  },
  {
    surface: "Terminal Orders",
    source: "routes/internal/terminal/orders/index.tsx",
    mobilePattern: /space-y-3 md:hidden/,
    desktopPattern: /hidden overflow-x-auto md:block/,
  },
];

/** Visible generic CTAs that should not appear on canonical list pages. */
export const FORBIDDEN_GENERIC_CTA_PATTERN = />\s*(Open|Manage|Queue|View)\s*</;

export const CANONICAL_LIST_SOURCES_FOR_CTA_SWEEP = [
  "routes/internal/users/index.tsx",
  "routes/internal/companies/index.tsx",
  "routes/internal/relationships/index.tsx",
  "routes/internal/bank/accounts/index.tsx",
  "routes/internal/bank/transactions/index.tsx",
  "routes/internal/bank/transfers/index.tsx",
  "routes/internal/lending/loans/index.tsx",
  "routes/internal/alta-card/cards/index.tsx",
  "routes/internal/terminal/investors/index.tsx",
  "routes/internal/terminal/portfolios/index.tsx",
  "routes/internal/terminal/orders/index.tsx",
] as const;
