import { d as transactions, l as portfolioSeries, n as florin, o as movers, r as holdings, s as orders, u as stocks } from "./mock-data-BOQymobG.mjs";
import { n as getFilings } from "./filings-n5rHsr91.mjs";
import { t as getIPOs } from "./ipos-BLQkR1mp.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-q9xPrXz_.js
var terminalDescription = "Market intelligence, portfolios, watchlists, analytics, and order entry in one institutional terminal.";
var terminalDashboard = {
	totalNetWorth: 8412209.4,
	portfolioValue: 1885285,
	dailyPnL: 24810,
	dailyPnLPercent: 1.32,
	cashAvailable: 184220.15,
	performanceSeries: portfolioSeries
};
var portfolioSummary = {
	cashBalance: 184220.15,
	unrealizedGain: 142880.42,
	realizedGain: 68420,
	totalReturn: 11.2
};
var sectorAllocation = [
	{
		sector: "Energy",
		weight: 32
	},
	{
		sector: "Financials",
		weight: 22
	},
	{
		sector: "Industrials",
		weight: 21
	},
	{
		sector: "Healthcare",
		weight: 10
	},
	{
		sector: "Materials",
		weight: 9
	},
	{
		sector: "Telecom",
		weight: 6
	}
];
var watchlistGroups = [
	{
		name: "Core Positions",
		items: stocks.slice(0, 4).map((s) => ({
			...s,
			alert: s.change >= 2 ? "Price above target" : void 0
		}))
	},
	{
		name: "IPO Watch",
		items: stocks.filter((s) => [
			"AURM",
			"ELRA",
			"KRNT"
		].includes(s.symbol))
	},
	{
		name: "Industrials",
		items: stocks.filter((s) => s.sector === "Industrials")
	}
];
var terminalResearch = [
	...getFilings(),
	{
		title: "NPC Energy Sector Outlook",
		category: "Company Report",
		date: "2026-06-20",
		issuer: "Alta Terminal Research",
		section: "reports"
	},
	{
		title: "ALTB Financials Deep Dive",
		category: "Company Report",
		date: "2026-06-18",
		issuer: "Alta Terminal Research",
		section: "reports"
	},
	{
		title: "Republic Macro Monitor — Q2",
		category: "Economic Report",
		date: "2026-06-15",
		issuer: "Alta Terminal Economics",
		section: "economic"
	}
];
var terminalNews = [
	{
		date: "2026-06-22",
		headline: "NSX-100 closes higher on energy sector strength",
		category: "Market",
		source: "Alta Exchange"
	},
	{
		date: "2026-06-22",
		headline: "NPC announces Harbor District refining capacity expansion",
		category: "Company",
		source: "Newport Petroleum Corp."
	},
	{
		date: "2026-06-21",
		headline: "Alta Exchange Daily Market Note published",
		category: "Exchange",
		source: "Alta Exchange"
	},
	{
		date: "2026-06-21",
		headline: "Alta Bank business deposits reach ƒ42B",
		category: "Bank",
		source: "Alta Bank"
	},
	{
		date: "2026-06-20",
		headline: "Republic inflation holds steady at 2.1% in May",
		category: "Macro",
		source: "Alta Terminal Economics"
	},
	{
		date: "2026-06-19",
		headline: "ELRA receives FDA-equivalent approval for Phase III candidate",
		category: "Company",
		source: "Elara Pharmaceuticals"
	},
	{
		date: "2026-06-18",
		headline: "Harbor Logistics Group IPO subscription opens on Alta Exchange",
		category: "Exchange",
		source: "Alta Exchange"
	},
	{
		date: "2026-06-17",
		headline: "Alta Private deposit program yields revised upward",
		category: "Bank",
		source: "Alta Bank"
	}
];
var terminalIpoAccess = getIPOs().map((ipo) => ({
	...ipo,
	allocationStatus: ipo.stage === "open" ? "Eligible — simulated" : ipo.stage === "upcoming" ? "Bookbuilding" : "Allocated"
}));
var leaderboard = {
	largestPortfolios: [
		{
			rank: 1,
			name: "Whitford Family Office",
			value: "ƒ12.1M",
			detail: "Private I"
		},
		{
			rank: 2,
			name: "Harbor Capital Partners",
			value: "ƒ8.4M",
			detail: "Institutional"
		},
		{
			rank: 3,
			name: "Meridian Holdings LLP",
			value: "ƒ4.8M",
			detail: "Business Premier"
		},
		{
			rank: 4,
			name: "Carter Whitford",
			value: "ƒ1.9M",
			detail: "Personal"
		},
		{
			rank: 5,
			name: "Northwind Development",
			value: "ƒ1.2M",
			detail: "Private"
		}
	],
	bestDaily: [
		{
			rank: 1,
			name: "Whitford Family Office",
			value: "+3.42%",
			detail: "ƒ414K"
		},
		{
			rank: 2,
			name: "Harbor Capital Partners",
			value: "+2.88%",
			detail: "ƒ242K"
		},
		{
			rank: 3,
			name: "Carter Whitford",
			value: "+2.14%",
			detail: "ƒ40K"
		},
		{
			rank: 4,
			name: "Meridian Holdings LLP",
			value: "+1.92%",
			detail: "ƒ92K"
		},
		{
			rank: 5,
			name: "Vintner & Co.",
			value: "+1.64%",
			detail: "ƒ18K"
		}
	],
	mostActive: [
		{
			rank: 1,
			name: "Harbor Capital Partners",
			value: "142 trades",
			detail: "Today"
		},
		{
			rank: 2,
			name: "Meridian Holdings LLP",
			value: "89 trades",
			detail: "Today"
		},
		{
			rank: 3,
			name: "Whitford Family Office",
			value: "64 trades",
			detail: "Today"
		},
		{
			rank: 4,
			name: "Carter Whitford",
			value: "28 trades",
			detail: "Today"
		},
		{
			rank: 5,
			name: "Northwind Development",
			value: "19 trades",
			detail: "Today"
		}
	],
	topPrivate: [
		{
			rank: 1,
			name: "Whitford Family Office",
			value: "ƒ12.1M",
			detail: "Tier I"
		},
		{
			rank: 2,
			name: "Northwind Development",
			value: "ƒ6.2M",
			detail: "Tier II"
		},
		{
			rank: 3,
			name: "Harbor Capital Partners",
			value: "ƒ28.4M",
			detail: "Institutional"
		}
	],
	winners: movers.gainers.slice(0, 5).map((s, i) => ({
		rank: i + 1,
		ticker: s.symbol,
		name: s.name,
		value: florin(s.price),
		change: s.change
	})),
	losers: movers.losers.slice(0, 5).map((s, i) => ({
		rank: i + 1,
		ticker: s.symbol,
		name: s.name,
		value: florin(s.price),
		change: s.change
	}))
};
var tradeDefaults = {
	ticker: "NPC",
	side: "Buy",
	orderType: "Market",
	quantity: 100,
	estimatedPrice: 412.55,
	availableCash: 184220.15
};
transactions.filter((t) => t.category === "Trade" || t.category === "Investment");
/** GET /v1/terminal/description */
function getTerminalDescription() {
	return terminalDescription;
}
/** GET /v1/terminal/dashboard */
function getTerminalDashboard() {
	return terminalDashboard;
}
/** GET /v1/terminal/portfolio/performance */
function getPortfolioSeries() {
	return portfolioSeries;
}
/** GET /v1/terminal/portfolio/summary */
function getPortfolioSummary() {
	return portfolioSummary;
}
/** GET /v1/terminal/portfolio/sector-allocation */
function getSectorAllocation() {
	return sectorAllocation;
}
/** GET /v1/terminal/portfolio/holdings */
function getHoldings() {
	return holdings;
}
/** GET /v1/terminal/portfolio/transactions */
function getPortfolioTransactions() {
	return transactions;
}
/** GET /v1/terminal/watchlist */
function getWatchlistGroups() {
	return watchlistGroups;
}
/** GET /v1/terminal/research */
function getTerminalResearch() {
	return terminalResearch;
}
/** GET /v1/terminal/news */
function getTerminalNews() {
	return terminalNews;
}
/** GET /v1/terminal/ipo-access */
function getTerminalIpoAccess() {
	return terminalIpoAccess;
}
/** GET /v1/terminal/leaderboard */
function getLeaderboard() {
	return leaderboard;
}
/** GET /v1/terminal/trade/defaults */
function getTradeDefaults() {
	return tradeDefaults;
}
/** GET /v1/terminal/orders */
function getOrders() {
	return orders;
}
//#endregion
export { getPortfolioSummary as a, getTerminalDashboard as c, getTerminalNews as d, getTerminalResearch as f, getPortfolioSeries as i, getTerminalDescription as l, getWatchlistGroups as m, getLeaderboard as n, getPortfolioTransactions as o, getTradeDefaults as p, getOrders as r, getSectorAllocation as s, getHoldings as t, getTerminalIpoAccess as u };
