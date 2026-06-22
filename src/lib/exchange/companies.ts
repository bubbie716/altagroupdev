import { compact, florin, makeSeries, stocks } from "@/lib/mock-data";
import type { CompanyProfile, ListedCompany } from "./types";

const listedCompanies: ListedCompany[] = stocks.map((s) => ({
  ...s,
  status: "Listed" as const,
}));

const npcProfile: CompanyProfile = {
  symbol: "NPC",
  name: "Newport Petroleum Corp.",
  sector: "Energy",
  exchange: "Alta Exchange",
  price: 412.55,
  change: 1.84,
  volume: 2_140_000,
  marketCap: 184_200_000_000,
  status: "Listed",
  sharesOutstanding: 446_500_000,
  ceo: "Adrian Vale",
  headquarters: "Newport Harbor District",
  description:
    "Newport Petroleum Corp. is a Florin-denominated energy company focused on fuel distribution, refining logistics, and industrial energy supply across the Republic.",
  shareholders: [
    { name: "Whitford Family Office", pct: 17.4 },
    { name: "Alta Institutional Holdings", pct: 12.8 },
    { name: "Founder Holdings", pct: 9.6 },
    { name: "Public Float", pct: 60.2 },
  ],
  filings: [
    { title: "FY Market Statement", date: "2026-05-30", type: "Annual" },
    { title: "Q2 Operating Update", date: "2026-06-18", type: "Quarterly" },
    { title: "Dividend Notice", date: "2026-06-12", type: "Corporate Action" },
    { title: "Listing Prospectus", date: "2024-03-14", type: "Prospectus" },
  ],
  corporateActions: [
    { action: "Dividend declared", detail: "ƒ2.10 per share · payable Jul 15" },
    { action: "Share buyback authorized", detail: "ƒ800M program · in progress" },
    { action: "No split pending", detail: "Board review scheduled Q4" },
  ],
  news: [
    { date: "2026-06-22", headline: "NPC announces Harbor District refining capacity expansion" },
    { date: "2026-06-19", headline: "Q2 operating update exceeds internal guidance" },
    { date: "2026-06-14", headline: "Board approves quarterly dividend of ƒ2.10 per share" },
    { date: "2026-06-08", headline: "NPC secures long-term supply agreement with Meridian Logistics" },
  ],
  keyStats: [
    { label: "P/E Ratio", value: "18.4x" },
    { label: "EPS (TTM)", value: "ƒ22.42" },
    { label: "Dividend Yield", value: "2.04%" },
    { label: "Beta", value: "0.92" },
    { label: "52w Range", value: "ƒ368.20 – ƒ428.90" },
    { label: "Avg Volume", value: "1.98M" },
  ],
  priceSeries: makeSeries(120, 380, 2.8, 0.28),
};

const companyDefaults: Record<string, Partial<CompanyProfile>> = {
  ALTB: {
    ceo: "Margaret Chen",
    headquarters: "Newport Financial District",
    description:
      "Alta Bank Holdings is the publicly listed parent of Alta Bank, providing Florin-denominated banking and financial services across the Republic.",
    sharesOutstanding: 323_000_000,
  },
  MRDN: {
    ceo: "James Whitmore",
    headquarters: "Meridian Industrial Park",
    description:
      "Meridian Logistics operates integrated freight, warehousing, and supply chain infrastructure across Newport and the eastern Republic.",
    sharesOutstanding: 162_600_000,
  },
};

function buildCompanyProfile(ticker: string): CompanyProfile | null {
  const sym = ticker.toUpperCase();
  if (sym === "NPC") return npcProfile;

  const listed = listedCompanies.find((c) => c.symbol === sym);
  if (!listed) return null;

  const defaults = companyDefaults[sym];
  return {
    ...listed,
    exchange: "Alta Exchange",
    sharesOutstanding: defaults?.sharesOutstanding ?? Math.round(listed.marketCap / listed.price),
    ceo: defaults?.ceo ?? "—",
    headquarters: defaults?.headquarters ?? "Newport, Republic",
    description:
      defaults?.description ??
      `${listed.name} is a Florin-denominated ${listed.sector.toLowerCase()} company listed on Alta Exchange.`,
    shareholders: [
      { name: "Institutional Holdings", pct: 34.2 },
      { name: "Founder & Management", pct: 18.6 },
      { name: "Public Float", pct: 47.2 },
    ],
    filings: [
      { title: "Annual Market Statement", date: "2026-05-28", type: "Annual" },
      { title: "Q2 Operating Update", date: "2026-06-15", type: "Quarterly" },
      { title: "Listing Prospectus", date: "2023-11-02", type: "Prospectus" },
    ],
    corporateActions: [{ action: "No pending actions", detail: "Last reviewed Jun 2026" }],
    news: [
      { date: "2026-06-20", headline: `${listed.name} publishes Q2 operating update` },
      { date: "2026-06-10", headline: `${listed.symbol} added to NSX sector index review` },
    ],
    keyStats: [
      { label: "P/E Ratio", value: "16.2x" },
      { label: "EPS (TTM)", value: florin(listed.price / 16.2) },
      { label: "Dividend Yield", value: "1.42%" },
      { label: "Beta", value: "1.08" },
      { label: "52w Range", value: `${florin(listed.price * 0.88)} – ${florin(listed.price * 1.12)}` },
      { label: "Avg Volume", value: compact(listed.volume * 0.92) },
    ],
    priceSeries: makeSeries(120, listed.price * 0.95, listed.price * 0.008, listed.price * 0.001),
  };
}

/** GET /v1/companies */
export function getCompanies(): ListedCompany[] {
  return listedCompanies;
}

/** GET /v1/companies/:ticker */
export function getCompany(ticker: string): CompanyProfile | null {
  return buildCompanyProfile(ticker);
}
