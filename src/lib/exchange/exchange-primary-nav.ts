export type ExchangePrimaryNavLink = {
  label: string;
  to: string;
  match?: string;
  exact?: boolean;
  external?: boolean;
  activePaths?: string[];
};

/** Header nav for Alta Exchange — mirrors bank primary nav; section subtabs live in ExchangeSubNav. */
export const EXCHANGE_PRIMARY_NAV_LINKS: ExchangePrimaryNavLink[] = [
  {
    label: "Overview",
    to: "/exchange",
    exact: true,
    match: "/exchange",
  },
  {
    label: "Listings",
    to: "/exchange/listings",
    match: "/exchange/listings",
    activePaths: ["/exchange/company"],
  },
  { label: "Rankings", to: "/exchange/rankings", match: "/exchange/rankings" },
  { label: "Indices", to: "/exchange/indices", match: "/exchange/indices" },
  { label: "IPO Center", to: "/exchange/ipo", match: "/exchange/ipo" },
  { label: "Corporate Actions", to: "/exchange/actions", match: "/exchange/actions" },
  { label: "Research", to: "/exchange/research", match: "/exchange/research" },
  {
    label: "Market Data",
    to: "/exchange/api",
    match: "/exchange/api",
    activePaths: ["/exchange/apply"],
  },
  { label: "Terminal", to: "/terminal", match: "/terminal" },
];

export function buildExchangePrimaryNavLinks(): ExchangePrimaryNavLink[] {
  return EXCHANGE_PRIMARY_NAV_LINKS;
}
