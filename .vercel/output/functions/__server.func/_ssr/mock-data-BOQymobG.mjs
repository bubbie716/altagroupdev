//#region node_modules/.nitro/vite/services/ssr/assets/mock-data-BOQymobG.js
var florin = (n) => "ƒ" + n.toLocaleString("en-US", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
var compact = (n) => Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 2
}).format(n);
var pct = (n) => (n > 0 ? "+" : "") + n.toFixed(2) + "%";
var stocks = [
	{
		symbol: "NPC",
		name: "Newport Petroleum Corp.",
		sector: "Energy",
		price: 412.55,
		change: 1.84,
		volume: 214e4,
		marketCap: 1842e8
	},
	{
		symbol: "ALTB",
		name: "Alta Bank Holdings",
		sector: "Financials",
		price: 286.1,
		change: .72,
		volume: 132e4,
		marketCap: 924e8
	},
	{
		symbol: "MRDN",
		name: "Meridian Logistics",
		sector: "Industrials",
		price: 148.22,
		change: -.41,
		volume: 884e3,
		marketCap: 241e8
	},
	{
		symbol: "HWY",
		name: "Halcyon Wireways",
		sector: "Telecom",
		price: 92.07,
		change: 2.36,
		volume: 1004e3,
		marketCap: 188e8
	},
	{
		symbol: "VRDA",
		name: "Veridian Agriculture",
		sector: "Consumer",
		price: 67.41,
		change: -1.18,
		volume: 612e3,
		marketCap: 123e8
	},
	{
		symbol: "AURM",
		name: "Aurum Mining Trust",
		sector: "Materials",
		price: 51.88,
		change: 3.42,
		volume: 199e4,
		marketCap: 965e7
	},
	{
		symbol: "CIVC",
		name: "Civic Power & Light",
		sector: "Utilities",
		price: 38.91,
		change: .12,
		volume: 421e3,
		marketCap: 712e7
	},
	{
		symbol: "PRTH",
		name: "Port Haven Maritime",
		sector: "Industrials",
		price: 124.3,
		change: -2.07,
		volume: 54e4,
		marketCap: 64e8
	},
	{
		symbol: "ELRA",
		name: "Elara Pharmaceuticals",
		sector: "Healthcare",
		price: 209.66,
		change: 1.05,
		volume: 702e3,
		marketCap: 149e8
	},
	{
		symbol: "NXST",
		name: "Nexstar Defense",
		sector: "Industrials",
		price: 374.12,
		change: .84,
		volume: 318e3,
		marketCap: 227e8
	},
	{
		symbol: "KRNT",
		name: "Korent Beverages",
		sector: "Consumer",
		price: 81.2,
		change: -.55,
		volume: 489e3,
		marketCap: 52e8
	},
	{
		symbol: "ORNL",
		name: "Oriental Rail Co.",
		sector: "Industrials",
		price: 156.78,
		change: 1.91,
		volume: 66e4,
		marketCap: 114e8
	}
];
function makeSeries(points = 120, base = 100, vol = .6, drift = .04) {
	let v = base;
	const out = [];
	for (let i = 0; i < points; i++) {
		const s = Math.sin(i / 6) * vol * .4;
		const r = (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * vol * .5;
		v += s + r + drift;
		out.push({
			t: i,
			v: Math.max(0, +v.toFixed(2))
		});
	}
	return out;
}
var portfolioSeries = makeSeries(180, 12e5, 4800, 1200);
makeSeries(180, 21e5, 6400, 1800);
var indexSeries = makeSeries(180, 17800, 28, 4);
var transactions = [
	{
		id: "tx_8821",
		date: "2026-06-22",
		desc: "Wire — Meridian Holdings LLP",
		category: "Transfer",
		amount: -24e4
	},
	{
		id: "tx_8819",
		date: "2026-06-21",
		desc: "Dividend — ALTB",
		category: "Income",
		amount: 18420
	},
	{
		id: "tx_8810",
		date: "2026-06-20",
		desc: "Treasury Bill auction",
		category: "Investment",
		amount: -5e5
	},
	{
		id: "tx_8804",
		date: "2026-06-19",
		desc: "Salary — Alta Group",
		category: "Income",
		amount: 92500
	},
	{
		id: "tx_8799",
		date: "2026-06-18",
		desc: "Card — Vintner & Co.",
		category: "Lifestyle",
		amount: -1280.4
	},
	{
		id: "tx_8790",
		date: "2026-06-17",
		desc: "Alta Terminal — NPC buy",
		category: "Trade",
		amount: -41255
	},
	{
		id: "tx_8782",
		date: "2026-06-17",
		desc: "FX — EUR settlement",
		category: "FX",
		amount: 12900
	},
	{
		id: "tx_8770",
		date: "2026-06-15",
		desc: "Loan — Treasury Services",
		category: "Credit",
		amount: 15e5
	}
];
var holdings = [
	{
		symbol: "NPC",
		shares: 1200,
		avg: 380.4,
		value: 495060,
		weight: .32
	},
	{
		symbol: "ALTB",
		shares: 2400,
		avg: 248.1,
		value: 686640,
		weight: .22
	},
	{
		symbol: "NXST",
		shares: 320,
		avg: 290,
		value: 119718,
		weight: .14
	},
	{
		symbol: "ELRA",
		shares: 540,
		avg: 188.2,
		value: 113216,
		weight: .1
	},
	{
		symbol: "AURM",
		shares: 4400,
		avg: 41.1,
		value: 228272,
		weight: .09
	},
	{
		symbol: "ORNL",
		shares: 900,
		avg: 140,
		value: 141102,
		weight: .07
	},
	{
		symbol: "HWY",
		shares: 1100,
		avg: 80.3,
		value: 101277,
		weight: .06
	}
];
var orders = [
	{
		id: "O-9921",
		side: "BUY",
		symbol: "NPC",
		qty: 200,
		price: 410.2,
		status: "Filled",
		time: "10:14:22"
	},
	{
		id: "O-9920",
		side: "SELL",
		symbol: "MRDN",
		qty: 540,
		price: 149,
		status: "Working",
		time: "10:09:48"
	},
	{
		id: "O-9918",
		side: "BUY",
		symbol: "AURM",
		qty: 1200,
		price: 50.1,
		status: "Filled",
		time: "09:58:11"
	},
	{
		id: "O-9914",
		side: "BUY",
		symbol: "ALTB",
		qty: 100,
		price: 285.4,
		status: "Cancelled",
		time: "09:42:03"
	},
	{
		id: "O-9907",
		side: "SELL",
		symbol: "ELRA",
		qty: 80,
		price: 210.5,
		status: "Working",
		time: "09:31:57"
	}
];
var movers = {
	gainers: stocks.filter((s) => s.change > 0).sort((a, b) => b.change - a.change).slice(0, 5),
	losers: stocks.filter((s) => s.change < 0).sort((a, b) => a.change - b.change).slice(0, 5)
};
//#endregion
export { makeSeries as a, pct as c, transactions as d, indexSeries as i, portfolioSeries as l, florin as n, movers as o, holdings as r, orders as s, compact as t, stocks as u };
