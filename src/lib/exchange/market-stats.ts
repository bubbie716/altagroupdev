import type { ExchangeIndex, MarketRankings, MarketStats } from "./types";
import { ALTA_TERMINAL_SUBTITLE } from "@/lib/branding/alta-products";

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

/** GET /v1/market/stats — empty until external exchange connectivity is available. */
export function getMarketStats(): MarketStats {
  return {
    description: `${ALTA_TERMINAL_SUBTITLE}. Market data unavailable.`,
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
