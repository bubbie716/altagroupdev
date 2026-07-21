// Mock data for Alta Group platform (roleplay economy, fictional)
// Retained for tests and non-production fixtures. Production formatters live in lib/format/money-display.ts.

export { compact, florin, pct } from "@/lib/format/money-display";

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number; // pct
  volume: number;
  marketCap: number;
}

export const stocks: Stock[] = [
  { symbol: "NPC", name: "Newport Petroleum Corp.", sector: "Energy", price: 412.55, change: 1.84, volume: 2_140_000, marketCap: 184_200_000_000 },
  { symbol: "ALTB", name: "Alta Bank Holdings", sector: "Financials", price: 286.10, change: 0.72, volume: 1_320_000, marketCap: 92_400_000_000 },
  { symbol: "MRDN", name: "Meridian Logistics", sector: "Industrials", price: 148.22, change: -0.41, volume: 884_000, marketCap: 24_100_000_000 },
  { symbol: "HWY", name: "Halcyon Wireways", sector: "Telecom", price: 92.07, change: 2.36, volume: 1_004_000, marketCap: 18_800_000_000 },
  { symbol: "VRDA", name: "Veridian Agriculture", sector: "Consumer", price: 67.41, change: -1.18, volume: 612_000, marketCap: 12_300_000_000 },
  { symbol: "AURM", name: "Aurum Mining Trust", sector: "Materials", price: 51.88, change: 3.42, volume: 1_990_000, marketCap: 9_650_000_000 },
  { symbol: "CIVC", name: "Civic Power & Light", sector: "Utilities", price: 38.91, change: 0.12, volume: 421_000, marketCap: 7_120_000_000 },
  { symbol: "PRTH", name: "Port Haven Maritime", sector: "Industrials", price: 124.30, change: -2.07, volume: 540_000, marketCap: 6_400_000_000 },
  { symbol: "ELRA", name: "Elara Pharmaceuticals", sector: "Healthcare", price: 209.66, change: 1.05, volume: 702_000, marketCap: 14_900_000_000 },
  { symbol: "NXST", name: "Nexstar Defense", sector: "Industrials", price: 374.12, change: 0.84, volume: 318_000, marketCap: 22_700_000_000 },
  { symbol: "KRNT", name: "Korent Beverages", sector: "Consumer", price: 81.20, change: -0.55, volume: 489_000, marketCap: 5_200_000_000 },
  { symbol: "ORNL", name: "Oriental Rail Co.", sector: "Industrials", price: 156.78, change: 1.91, volume: 660_000, marketCap: 11_400_000_000 },
];

// Smooth synthetic time series (deterministic)
export function makeSeries(points = 120, base = 100, vol = 0.6, drift = 0.04) {
  let v = base;
  const out: { t: number; v: number }[] = [];
  for (let i = 0; i < points; i++) {
    const s = Math.sin(i / 6) * vol * 0.4;
    const r = (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * vol * 0.5;
    v += s + r + drift;
    out.push({ t: i, v: Math.max(0, +v.toFixed(2)) });
  }
  return out;
}

export const portfolioSeries = makeSeries(180, 1_200_000, 4_800, 1_200);
export const netWorthSeries = makeSeries(180, 2_100_000, 6_400, 1_800);
export const indexSeries = makeSeries(180, 17_800, 28, 4);

export const transactions = [
  { id: "tx_8821", date: "2026-06-22", desc: "Wire — Meridian Holdings LLP", category: "Transfer", amount: -240_000 },
  { id: "tx_8819", date: "2026-06-21", desc: "Dividend — ALTB", category: "Income", amount: 18_420 },
  { id: "tx_8810", date: "2026-06-20", desc: "Treasury Bill auction", category: "Investment", amount: -500_000 },
  { id: "tx_8804", date: "2026-06-19", desc: "Salary — Alta Group", category: "Income", amount: 92_500 },
  { id: "tx_8799", date: "2026-06-18", desc: "Card — Vintner & Co.", category: "Lifestyle", amount: -1_280.4 },
  { id: "tx_8790", date: "2026-06-17", desc: "Alta Terminal — NPC buy", category: "Trade", amount: -41_255 },
  { id: "tx_8782", date: "2026-06-17", desc: "FX — EUR settlement", category: "FX", amount: 12_900 },
  { id: "tx_8770", date: "2026-06-15", desc: "Loan — Treasury Services", category: "Credit", amount: 1_500_000 },
];

export const holdings = [
  { symbol: "NPC", shares: 1200, avg: 380.40, value: 495_060, weight: 0.32 },
  { symbol: "ALTB", shares: 2400, avg: 248.10, value: 686_640, weight: 0.22 },
  { symbol: "NXST", shares: 320, avg: 290.00, value: 119_718, weight: 0.14 },
  { symbol: "ELRA", shares: 540, avg: 188.20, value: 113_216, weight: 0.10 },
  { symbol: "AURM", shares: 4400, avg: 41.10, value: 228_272, weight: 0.09 },
  { symbol: "ORNL", shares: 900, avg: 140.00, value: 141_102, weight: 0.07 },
  { symbol: "HWY", shares: 1100, avg: 80.30, value: 101_277, weight: 0.06 },
];

export const orders = [
  { id: "O-9921", side: "BUY", symbol: "NPC", qty: 200, price: 410.20, status: "Filled", time: "10:14:22" },
  { id: "O-9920", side: "SELL", symbol: "MRDN", qty: 540, price: 149.00, status: "Working", time: "10:09:48" },
  { id: "O-9918", side: "BUY", symbol: "AURM", qty: 1200, price: 50.10, status: "Filled", time: "09:58:11" },
  { id: "O-9914", side: "BUY", symbol: "ALTB", qty: 100, price: 285.40, status: "Cancelled", time: "09:42:03" },
  { id: "O-9907", side: "SELL", symbol: "ELRA", qty: 80, price: 210.50, status: "Working", time: "09:31:57" },
];

export const accounts = [
  { id: "ALTA-PRIV-0021", name: "Alta Private Wealth", type: "Private", balance: 4_812_440.22, currency: "ƒ" },
  { id: "ALTA-CHK-1187", name: "Alta Checking", type: "Personal", balance: 184_220.15, currency: "ƒ" },
  { id: "ALTA-SAV-7740", name: "Alta High-Yield Reserve", type: "Savings", balance: 1_240_500.00, currency: "ƒ" },
  { id: "ALTA-BIZ-4402", name: "Meridian Holdings Operating", type: "Business", balance: 2_390_115.84, currency: "ƒ" },
  { id: "ALTA-TRY-0001", name: "Treasury Sweep — T-Bills", type: "Treasury", balance: 7_500_000.00, currency: "ƒ" },
];

export const movers = {
  gainers: stocks.filter((s) => s.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
  losers: stocks.filter((s) => s.change < 0).sort((a, b) => a.change - b.change).slice(0, 5),
};