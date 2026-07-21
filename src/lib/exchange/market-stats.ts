import type { ExchangeIndex, MarketRankings, MarketStats } from "./types";
import { ALTA_EXCHANGE_TAGLINE } from "@/lib/branding/alta-products";

const exchangeDescription = ALTA_EXCHANGE_TAGLINE;

const emptyIndex: ExchangeIndex = {
  symbol: "NSX-100",
  name: "NSX 100 Index",
  value: 0,
  change: 0,
  constituents: 0,
  category: "Broad Market",
  series: [],
};

const emptyRankings: MarketRankings = {
  gainers: [],
  losers: [],
  mostActive: [],
  largest: [],
  highestVolume: [],
};

/** GET /v1/market/stats */
export function getMarketStats(): MarketStats {
  return {
    description: exchangeDescription,
    stats: [],
    snapshot: {
      index: emptyIndex,
      status: "Unavailable",
      time: "—",
      turnover: "—",
      listed: 0,
    },
    rankings: emptyRankings,
  };
}
