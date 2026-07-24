export type TerminalPrimaryNavLink = {
  label: string;
  to: string;
  match?: string;
  exact?: boolean;
  external?: boolean;
  activePaths?: string[];
};

/** Header nav for Alta Terminal — brokerage workspace (V1). */
export const TERMINAL_PRIMARY_NAV_LINKS: TerminalPrimaryNavLink[] = [
  {
    label: "Home",
    to: "/terminal",
    exact: true,
    match: "/terminal",
  },
  { label: "Markets", to: "/terminal/markets", match: "/terminal/markets" },
  { label: "Portfolio", to: "/terminal/portfolio", match: "/terminal/portfolio" },
  { label: "Watchlist", to: "/terminal/watchlist", match: "/terminal/watchlist" },
  {
    label: "Orders",
    to: "/terminal/orders",
    match: "/terminal/orders",
    activePaths: ["/terminal/trade"],
  },
];

export function buildTerminalPrimaryNavLinks(): TerminalPrimaryNavLink[] {
  return TERMINAL_PRIMARY_NAV_LINKS;
}
