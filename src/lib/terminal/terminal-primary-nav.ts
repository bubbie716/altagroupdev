export type TerminalPrimaryNavLink = {
  label: string;
  to: string;
  match?: string;
  exact?: boolean;
  external?: boolean;
  activePaths?: string[];
};

/** Header nav for Alta Terminal — brokerage workspace. */
export const TERMINAL_PRIMARY_NAV_LINKS: TerminalPrimaryNavLink[] = [
  {
    label: "Dashboard",
    to: "/terminal",
    exact: true,
    match: "/terminal",
  },
  { label: "Portfolio", to: "/terminal/portfolio", match: "/terminal/portfolio" },
  { label: "Watchlist", to: "/terminal/watchlist", match: "/terminal/watchlist" },
  { label: "Trade", to: "/terminal/trade", match: "/terminal/trade" },
  { label: "Research", to: "/terminal/research", match: "/terminal/research" },
  { label: "IPO Access", to: "/terminal/ipo", match: "/terminal/ipo" },
  { label: "News", to: "/terminal/news", match: "/terminal/news" },
  { label: "Leaderboard", to: "/terminal/leaderboard", match: "/terminal/leaderboard" },
];

export function buildTerminalPrimaryNavLinks(): TerminalPrimaryNavLink[] {
  return TERMINAL_PRIMARY_NAV_LINKS;
}
