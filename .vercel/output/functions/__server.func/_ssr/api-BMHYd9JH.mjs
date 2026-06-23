import { a as makeSeries, d as transactions } from "./mock-data-BOQymobG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-BMHYd9JH.js
var bankDescription = "Personal banking, business accounts, deposits, lending, and treasury services for Newport citizens, builders, and institutions.";
var bankDashboard = {
	totalRelationshipValue: 12127276.21,
	checkingBalance: 184220.15,
	savingsBalance: 1240500,
	reserveBalance: 289e4,
	creditAvailable: 35e5,
	privateStatus: "Alta Private · Tier I",
	balanceTrend: makeSeries(90, 118e5, 12e4, 4200)
};
var bankAccounts = [
	{
		id: "ALTA-CHK-1187",
		name: "Alta Checking",
		product: "Checking",
		type: "Personal",
		accountNumber: "•••• 1187",
		balance: 184220.15,
		status: "Active",
		recentActivity: "Wire — Meridian Holdings · Jun 22"
	},
	{
		id: "ALTA-SAV-7740",
		name: "Alta Savings",
		product: "Savings",
		type: "Personal",
		accountNumber: "•••• 7740",
		balance: 890500,
		status: "Active",
		recentActivity: "Interest credit · Jun 21"
	},
	{
		id: "ALTA-RSV-3312",
		name: "Alta Reserve",
		product: "Reserve",
		type: "Personal",
		accountNumber: "•••• 3312",
		balance: 289e4,
		status: "Active",
		recentActivity: "Transfer from Checking · Jun 20"
	},
	{
		id: "ALTA-BIZ-4402",
		name: "Alta Business Operating",
		product: "Operating",
		type: "Business",
		accountNumber: "•••• 4402",
		balance: 2390115.84,
		status: "Active",
		recentActivity: "Payroll disbursement · Jun 19"
	},
	{
		id: "ALTA-PRIV-0021",
		name: "Alta Private Wealth",
		product: "Private Wealth",
		type: "Private",
		accountNumber: "•••• 0021",
		balance: 4812440.22,
		status: "Active",
		recentActivity: "Private CD placement · Jun 18"
	}
];
var depositProducts = [
	{
		name: "Alta Access",
		minimumBalance: "None",
		bestFor: "New citizens and first-time account holders",
		benefits: [
			"No minimum balance",
			"Basic checking access",
			"Starter transfers",
			"Upgrade path to Alta Checking"
		],
		availability: "Open to new Newport citizens"
	},
	{
		name: "Alta Checking",
		minimumBalance: "ƒ25,000",
		bestFor: "Primary operating liquidity for established Newport citizens",
		benefits: [
			"Same-day NCC-Net wires",
			"Dedicated relationship support",
			"Integrated Alta Terminal access"
		],
		availability: "Available to Newport citizens and residents"
	},
	{
		name: "Alta Savings",
		minimumBalance: "ƒ100,000",
		bestFor: "Core cash reserves with institutional yield tiers",
		benefits: [
			"Tiered APY",
			"Monthly liquidity",
			"Automated sweep to Alta Reserve"
		],
		availability: "Open with any Alta checking relationship"
	},
	{
		name: "Alta Reserve",
		minimumBalance: "ƒ500,000",
		bestFor: "High-balance cash management and treasury positioning",
		benefits: [
			"Enhanced yield",
			"Treasury sweep",
			"Priority NCC-Net settlement"
		],
		availability: "Available for balances above minimum"
	},
	{
		name: "Alta Certificates of Deposit",
		minimumBalance: "ƒ250,000",
		bestFor: "Defined-term capital preservation with published institutional terms",
		benefits: [
			"90d to 5y terms",
			"Callable options",
			"Florin-denominated"
		],
		availability: "Public terms published monthly"
	},
	{
		name: "Alta Private Deposit Program",
		minimumBalance: "ƒ1,000,000",
		bestFor: "Relationship-tier deposits with enhanced terms and private banker coverage",
		benefits: [
			"Relationship-priced yield",
			"Flexible liquidity windows",
			"Dedicated placement desk"
		],
		availability: "Alta Private members only"
	},
	{
		name: "Private Negotiated CDs",
		minimumBalance: "ƒ2,000,000",
		bestFor: "Large balances requiring bespoke tenor and negotiated rate structures",
		benefits: [
			"Negotiated rate",
			"Custom tenor",
			"Private banker execution"
		],
		availability: "Alta Private · by invitation"
	}
];
var lendingProducts = [
	{
		name: "Personal Credit Line",
		limit: "Up to ƒ1.5M",
		rate: "SOFR + 2.40%",
		summary: "Unsecured revolving credit for established Alta Bank personal clients.",
		status: "Available"
	},
	{
		name: "Business Credit",
		limit: "Up to ƒ10M",
		rate: "SOFR + 1.85%",
		summary: "Operating lines for Newport companies with verified institutional cash flow.",
		status: "Available"
	},
	{
		name: "Private Liquidity Line",
		limit: "Up to ƒ25M",
		rate: "Negotiated",
		summary: "Standby liquidity for Alta Private clients — inspired by institutional standby facilities, simplified for relationship banking.",
		status: "By invitation"
	},
	{
		name: "Secured Lending",
		limit: "Portfolio-based",
		rate: "L + 1.10%",
		summary: "Lending against eligible securities held at Alta Terminal.",
		status: "Available"
	},
	{
		name: "Short-Term Capital",
		limit: "ƒ500K – ƒ5M",
		rate: "Fixed term",
		summary: "Bridge financing for acquisitions, settlements, and capital events.",
		status: "Under review"
	}
];
var transferHistory = [
	{
		id: "TRF-8821",
		date: "2026-06-22",
		type: "Wire",
		from: "Alta Checking ••1187",
		to: "Meridian Holdings LLP",
		amount: -24e4,
		status: "Completed",
		settlement: "NCC-Net"
	},
	{
		id: "TRF-8814",
		date: "2026-06-21",
		type: "Internal",
		from: "Alta Checking ••1187",
		to: "Alta Reserve ••3312",
		amount: -15e4,
		status: "Completed",
		settlement: "Alta Bank"
	},
	{
		id: "TRF-8808",
		date: "2026-06-25",
		type: "Scheduled",
		from: "Alta Business ••4402",
		to: "Payroll — Staff Accounts",
		amount: -428500,
		status: "Scheduled",
		settlement: "NCC-Net"
	},
	{
		id: "TRF-8795",
		date: "2026-06-18",
		type: "Wire",
		from: "Alta Private ••0021",
		to: "Harbor Capital Partners",
		amount: -12e5,
		status: "Completed",
		settlement: "NCC-Net"
	}
];
var privateBanking = {
	tier: "Tier I · Founding Relationship",
	banker: "Eleanor Whitmore",
	bankerTitle: "Managing Director · Private Banking",
	card: "Alta Private Metal",
	cardLimit: "ƒ500,000 monthly",
	lending: "ƒ8.5M standby liquidity reserved",
	cds: "2 active negotiated placements",
	liquidityLine: "ƒ12M approved · undrawn"
};
var privateMetrics = [
	{
		label: "Current Members",
		value: "47"
	},
	{
		label: "New Invitations This Year",
		value: "3"
	},
	{
		label: "Minimum Relationship Value",
		value: "ƒ5M"
	},
	{
		label: "Applications",
		value: "Closed"
	}
];
var businessMetrics = [
	{
		label: "Client Deposits",
		value: "ƒ42B"
	},
	{
		label: "Treasury Clients",
		value: "312"
	},
	{
		label: "Payroll Processed",
		value: "ƒ4.2B / month"
	},
	{
		label: "Business Credit",
		value: "ƒ18B committed"
	},
	{
		label: "Business Accounts",
		value: "1,842"
	}
];
var businessServices = [
	{
		name: "Operating Accounts",
		desc: "Multi-entity cash management for Newport companies and family offices.",
		metric: "1,842 business accounts"
	},
	{
		name: "Merchant Accounts",
		desc: "Institutional settlement and receivables for Newport merchants.",
		metric: "NCC-Net · T+0 settlement"
	},
	{
		name: "Payroll Services",
		desc: "Disbursement, tax withholding, and employee accounts at institutional scale.",
		metric: "ƒ4.2B processed monthly"
	},
	{
		name: "Business Lending",
		desc: "Revolving and term credit for operating companies and institutions.",
		metric: "ƒ18B committed"
	},
	{
		name: "Treasury Services",
		desc: "Sweep, FX, and short-term instruments for corporate treasury desks.",
		metric: "312 treasury clients"
	}
];
var bankRecentActivity = transactions.slice(0, 6);
var bankMarketingSections = [
	{
		title: "Alta Access",
		desc: "Starter banking for new Newport citizens — no minimum balance.",
		to: "/bank/deposits"
	},
	{
		title: "Alta Checking",
		desc: "Primary operating accounts for established Newport citizens.",
		to: "/bank/deposits"
	},
	{
		title: "Business Banking",
		desc: "Operating accounts, payroll, and treasury for Newport institutions.",
		to: "/bank/business"
	},
	{
		title: "Deposit Products",
		desc: "Florin-denominated deposits from Access through Private Negotiated CDs.",
		to: "/bank/deposits"
	},
	{
		title: "Lending",
		desc: "Personal, business, and secured credit for Newport's leading clients.",
		to: "/bank/lending"
	},
	{
		title: "Transfers & Wires",
		desc: "Internal transfers and NCC-Net wire settlement — planned clearing infrastructure.",
		to: "/bank/transfers"
	},
	{
		title: "Financial Position",
		desc: "Balances, credit access, private status, and activity across your Alta Bank relationship.",
		to: "/bank/dashboard"
	},
	{
		title: "Alta Private",
		desc: "Invitation-only private banking — reserved for Newport's most influential clients.",
		to: "/bank/private"
	}
];
/** GET /v1/bank/description */
function getBankDescription() {
	return bankDescription;
}
/** GET /v1/bank/dashboard */
function getBankDashboard() {
	return bankDashboard;
}
/** GET /v1/bank/accounts */
function getBankAccounts() {
	return bankAccounts;
}
/** GET /v1/bank/deposits */
function getDepositProducts() {
	return depositProducts;
}
/** GET /v1/bank/lending */
function getLendingProducts() {
	return lendingProducts;
}
/** GET /v1/bank/transfers */
function getTransferHistory() {
	return transferHistory;
}
/** GET /v1/bank/private */
function getPrivateBanking() {
	return privateBanking;
}
/** GET /v1/bank/private/metrics */
function getPrivateMetrics() {
	return privateMetrics;
}
/** GET /v1/bank/business/metrics */
function getBusinessMetrics() {
	return businessMetrics;
}
/** GET /v1/bank/business/services */
function getBusinessServices() {
	return businessServices;
}
/** GET /v1/bank/activity/recent */
function getRecentActivity() {
	return bankRecentActivity;
}
/** GET /v1/bank/marketing */
function getMarketingSections() {
	return bankMarketingSections;
}
//#endregion
export { getBusinessServices as a, getMarketingSections as c, getRecentActivity as d, getTransferHistory as f, getBusinessMetrics as i, getPrivateBanking as l, getBankDashboard as n, getDepositProducts as o, getBankDescription as r, getLendingProducts as s, getBankAccounts as t, getPrivateMetrics as u };
