import { makeSeries } from "@/lib/mock-data";
import type { ExchangeIndex } from "./types";

const exchangeIndices: ExchangeIndex[] = [
  {
    symbol: "NSX-100",
    name: "NSX 100 Index",
    value: 18_472.31,
    change: 0.62,
    constituents: 100,
    category: "Broad Market",
    series: makeSeries(60, 18_200, 42, 4.8),
  },
  {
    symbol: "NSX-FIN",
    name: "NSX Financials",
    value: 4_201.14,
    change: 0.41,
    constituents: 24,
    category: "Sector",
    series: makeSeries(60, 4_150, 12, 0.9),
  },
  {
    symbol: "NSX-IND",
    name: "NSX Industrials",
    value: 6_812.99,
    change: -0.18,
    constituents: 38,
    category: "Sector",
    series: makeSeries(60, 6_780, 18, -0.3),
  },
  {
    symbol: "NSX-EN",
    name: "NSX Energy",
    value: 3_904.66,
    change: 1.27,
    constituents: 12,
    category: "Sector",
    series: makeSeries(60, 3_860, 14, 0.8),
  },
  {
    symbol: "NSX-CMP",
    name: "NSX Composite",
    value: 12_840.55,
    change: 0.48,
    constituents: 184,
    category: "Composite",
    series: makeSeries(60, 12_700, 28, 2.4),
  },
  {
    symbol: "NSX-SMC",
    name: "NSX Small Cap",
    value: 2_184.20,
    change: -0.62,
    constituents: 64,
    category: "Small Cap",
    series: makeSeries(60, 2_160, 8, -0.4),
  },
];

/** GET /v1/indices */
export function getIndices(): ExchangeIndex[] {
  return exchangeIndices;
}

/** GET /v1/indices/:symbol */
export function getIndex(symbol: string): ExchangeIndex | null {
  return exchangeIndices.find((idx) => idx.symbol === symbol.toUpperCase()) ?? null;
}
