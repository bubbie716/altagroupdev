import { compact, florin } from "@/lib/mock-data";
import { getCompanies } from "./companies";
import { getIndices } from "./indices";
import type { MarketRankings, MarketStats } from "./types";

import { ALTA_EXCHANGE_TAGLINE } from "@/lib/branding/alta-products";

const exchangeDescription = ALTA_EXCHANGE_TAGLINE;

const exchangeStats = [
  { label: "Total Listed", value: "184" },
  { label: "Market Cap", value: "ƒ428.2B" },
  { label: "Daily Turnover", value: "ƒ12.4B" },
  { label: "Advancers", value: "84" },
  { label: "Decliners", value: "47" },
  { label: "Unchanged", value: "11" },
  { label: "52w High", value: "19,021.74" },
  { label: "52w Low", value: "14,802.10" },
];

function buildMarketRankings(): MarketRankings {
  const listedCompanies = getCompanies();

  return {
    gainers: listedCompanies
      .slice()
      .sort((a, b) => b.change - a.change)
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        ticker: c.symbol,
        company: c.name,
        value: florin(c.price),
        change: c.change,
      })),
    losers: listedCompanies
      .slice()
      .sort((a, b) => a.change - b.change)
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        ticker: c.symbol,
        company: c.name,
        value: florin(c.price),
        change: c.change,
      })),
    mostActive: listedCompanies
      .slice()
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        ticker: c.symbol,
        company: c.name,
        value: compact(c.volume),
      })),
    largest: listedCompanies
      .slice()
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        ticker: c.symbol,
        company: c.name,
        value: `ƒ${compact(c.marketCap)}`,
      })),
    highestVolume: listedCompanies
      .slice()
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((c, i) => ({
        rank: i + 1,
        ticker: c.symbol,
        company: c.name,
        value: compact(c.volume),
      })),
  };
}

/** GET /v1/market/stats */
export function getMarketStats(): MarketStats {
  const indices = getIndices();

  return {
    description: exchangeDescription,
    stats: exchangeStats,
    snapshot: {
      index: indices[0],
      status: "Open",
      time: "10:34 NPT",
      turnover: "ƒ12.4B",
      listed: 184,
    },
    rankings: buildMarketRankings(),
  };
}
