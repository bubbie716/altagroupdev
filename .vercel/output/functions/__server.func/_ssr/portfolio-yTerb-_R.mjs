import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { n as florin } from "./mock-data-BOQymobG.mjs";
import { c as Cell, n as PieChart, s as Pie, u as ResponsiveContainer } from "../_libs/recharts+victory-vendor.mjs";
import { a as getPortfolioSummary, i as getPortfolioSeries, o as getPortfolioTransactions, s as getSectorAllocation, t as getHoldings } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-CN6tJP6E.mjs";
import { n as PortfolioChart, r as TerminalStatCard, t as HoldingsTable } from "./portfolio-chart-BDbHtW_l.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portfolio-yTerb-_R.js
var import_jsx_runtime = require_jsx_runtime();
var allocColors = [
	"var(--gold)",
	"var(--primary-glow)",
	"var(--success)",
	"#94A3B8",
	"#475569",
	"#7C5E2A"
];
function TerminalPortfolio() {
	const s = getPortfolioSummary();
	const holdings = getHoldings();
	const portfolioSeries = getPortfolioSeries();
	const sectorAllocation = getSectorAllocation();
	const transactions = getPortfolioTransactions();
	const allocationData = holdings.map((h) => ({
		name: h.symbol,
		value: h.value
	}));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · Portfolio",
		title: "Portfolio",
		description: "Holdings, allocation, performance, and transaction history — simulated preview data.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Cash Balance",
						value: florin(s.cashBalance)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Unrealized Gain",
						value: `+${florin(s.unrealizedGain)}`,
						accent: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Realized Gain",
						value: `+${florin(s.realizedGain)}`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Total Return",
						value: `+${s.totalReturn}%`,
						accent: true
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Performance",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioChart, {
						data: portfolioSeries,
						gradientId: "terminalPortfolio"
					}) })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Allocation",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[140px_1fr] gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-[160px]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
								width: "100%",
								height: "100%",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PieChart, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pie, {
									data: allocationData,
									dataKey: "value",
									innerRadius: 48,
									outerRadius: 70,
									paddingAngle: 2,
									stroke: "var(--surface-1)",
									children: allocationData.map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cell, { fill: allocColors[i % allocColors.length] }, i))
								}) })
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "space-y-1.5 self-center",
							children: holdings.map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between text-[12px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "h-2 w-2 rounded-full",
										style: { background: allocColors[i % allocColors.length] }
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono",
										children: h.symbol
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "tabular text-muted-foreground",
									children: [(h.weight * 100).toFixed(1), "%"]
								})]
							}, h.symbol))
						})]
					}) })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Sector Allocation",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "space-y-3",
					children: sectorAllocation.map((sec) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex justify-between text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: sec.sector }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "tabular font-mono",
							children: [sec.weight.toFixed(1), "%"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full rounded-full bg-gold/70",
							style: { width: `${sec.weight}%` }
						})
					})] }, sec.sector))
				}) })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Holdings",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldingsTable, { rows: holdings })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Transaction History",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "!p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Date"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Description"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Category"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Amount"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: transactions.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
									children: t.date
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3",
									children: t.desc
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 text-muted-foreground",
									children: t.category
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: `tabular px-5 py-3 text-right ${t.amount >= 0 ? "ticker-up" : ""}`,
									children: [t.amount >= 0 ? "+" : "", florin(t.amount)]
								})
							]
						}, t.id)) })]
					})
				})
			})
		]
	});
}
//#endregion
export { TerminalPortfolio as component };
