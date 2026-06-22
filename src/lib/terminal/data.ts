import {
  compact,
  florin,
  holdings,
  movers,
  orders,
  pct,
  portfolioSeries,
  stocks,
  transactions,
} from "@/lib/mock-data";
import { getFilings, getIPOs } from "@/lib/exchange/api";
import type { TerminalNewsItem, TerminalResearchItem } from "./types";

export { compact, florin, pct, holdings, orders, stocks, portfolioSeries, movers, transactions };

export const terminalDescription =
  "Market intelligence, portfolios, watchlists, analytics, and order entry in one institutional terminal.";

export const terminalDashboard = {
  totalNetWorth: 8_412_209.4,
  portfolioValue: 1_885_285,
  dailyPnL: 24_810,
  dailyPnLPercent: 1.32,
  cashAvailable: 184_220.15,
  performanceSeries: portfolioSeries,
};

export const portfolioSummary = {
  cashBalance: 184_220.15,
  unrealizedGain: 142_880.42,
  realizedGain: 68_420.0,
  totalReturn: 11.2,
};

export const sectorAllocation = [
  { sector: "Energy", weight: 32.0 },
  { sector: "Financials", weight: 22.0 },
  { sector: "Industrials", weight: 21.0 },
  { sector: "Healthcare", weight: 10.0 },
  { sector: "Materials", weight: 9.0 },
  { sector: "Telecom", weight: 6.0 },
];

export const watchlistGroups = [
  {
    name: "Core Positions",
    items: stocks.slice(0, 4).map((s) => ({
      ...s,
      alert: s.change >= 2 ? "Price above target" : undefined,
    })),
  },
  {
    name: "IPO Watch",
    items: stocks.filter((s) => ["AURM", "ELRA", "KRNT"].includes(s.symbol)),
  },
  {
    name: "Industrials",
    items: stocks.filter((s) => s.sector === "Industrials"),
  },
];

export const terminalResearch: TerminalResearchItem[] = [
  ...getFilings(),
  { title: "NPC Energy Sector Outlook", category: "Company Report", date: "2026-06-20", issuer: "Alta Terminal Research", section: "reports" },
  { title: "ALTB Financials Deep Dive", category: "Company Report", date: "2026-06-18", issuer: "Alta Terminal Research", section: "reports" },
  { title: "Republic Macro Monitor — Q2", category: "Economic Report", date: "2026-06-15", issuer: "Alta Terminal Economics", section: "economic" },
];

export const terminalNews: TerminalNewsItem[] = [
  { date: "2026-06-22", headline: "NSX-100 closes higher on energy sector strength", category: "Market", source: "Alta Exchange" },
  { date: "2026-06-22", headline: "NPC announces Harbor District refining capacity expansion", category: "Company", source: "Newport Petroleum Corp." },
  { date: "2026-06-21", headline: "Alta Exchange Daily Market Note published", category: "Exchange", source: "Alta Exchange" },
  { date: "2026-06-21", headline: "Alta Bank business deposits reach ƒ42B", category: "Bank", source: "Alta Bank" },
  { date: "2026-06-20", headline: "Republic inflation holds steady at 2.1% in May", category: "Macro", source: "Alta Terminal Economics" },
  { date: "2026-06-19", headline: "ELRA receives FDA-equivalent approval for Phase III candidate", category: "Company", source: "Elara Pharmaceuticals" },
  { date: "2026-06-18", headline: "Harbor Logistics Group IPO subscription opens on Alta Exchange", category: "Exchange", source: "Alta Exchange" },
  { date: "2026-06-17", headline: "Alta Private deposit program yields revised upward", category: "Bank", source: "Alta Bank" },
];

export const terminalIpoAccess = getIPOs().map((ipo) => ({
  ...ipo,
  allocationStatus:
    ipo.stage === "open"
      ? "Eligible — simulated"
      : ipo.stage === "upcoming"
        ? "Bookbuilding"
        : "Allocated",
}));

export const leaderboard = {
  largestPortfolios: [
    { rank: 1, name: "Whitford Family Office", value: "ƒ12.1M", detail: "Private I" },
    { rank: 2, name: "Harbor Capital Partners", value: "ƒ8.4M", detail: "Institutional" },
    { rank: 3, name: "Meridian Holdings LLP", value: "ƒ4.8M", detail: "Business Premier" },
    { rank: 4, name: "Carter Whitford", value: "ƒ1.9M", detail: "Personal" },
    { rank: 5, name: "Northwind Development", value: "ƒ1.2M", detail: "Private" },
  ],
  bestDaily: [
    { rank: 1, name: "Whitford Family Office", value: "+3.42%", detail: "ƒ414K" },
    { rank: 2, name: "Harbor Capital Partners", value: "+2.88%", detail: "ƒ242K" },
    { rank: 3, name: "Carter Whitford", value: "+2.14%", detail: "ƒ40K" },
    { rank: 4, name: "Meridian Holdings LLP", value: "+1.92%", detail: "ƒ92K" },
    { rank: 5, name: "Vintner & Co.", value: "+1.64%", detail: "ƒ18K" },
  ],
  mostActive: [
    { rank: 1, name: "Harbor Capital Partners", value: "142 trades", detail: "Today" },
    { rank: 2, name: "Meridian Holdings LLP", value: "89 trades", detail: "Today" },
    { rank: 3, name: "Whitford Family Office", value: "64 trades", detail: "Today" },
    { rank: 4, name: "Carter Whitford", value: "28 trades", detail: "Today" },
    { rank: 5, name: "Northwind Development", value: "19 trades", detail: "Today" },
  ],
  topPrivate: [
    { rank: 1, name: "Whitford Family Office", value: "ƒ12.1M", detail: "Tier I" },
    { rank: 2, name: "Northwind Development", value: "ƒ6.2M", detail: "Tier II" },
    { rank: 3, name: "Harbor Capital Partners", value: "ƒ28.4M", detail: "Institutional" },
  ],
  winners: movers.gainers.slice(0, 5).map((s, i) => ({
    rank: i + 1,
    ticker: s.symbol,
    name: s.name,
    value: florin(s.price),
    change: s.change,
  })),
  losers: movers.losers.slice(0, 5).map((s, i) => ({
    rank: i + 1,
    ticker: s.symbol,
    name: s.name,
    value: florin(s.price),
    change: s.change,
  })),
};

export const tradeDefaults = {
  ticker: "NPC",
  side: "Buy" as const,
  orderType: "Market",
  quantity: 100,
  estimatedPrice: 412.55,
  availableCash: 184_220.15,
};

export const tradeHistory = transactions.filter((t) => t.category === "Trade" || t.category === "Investment");

export function getEstimatedCost(qty: number, price: number) {
  return qty * price;
}
