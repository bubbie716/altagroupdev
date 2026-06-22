import { c as pct, n as florin, o as movers } from "./mock-data-BOQymobG.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-Czj8D5TM.mjs";
import { c as getTerminalDashboard, d as getTerminalNews, l as getTerminalDescription, m as getWatchlistGroups, r as getOrders, t as getHoldings, u as getTerminalIpoAccess } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-QnlozaY-.mjs";
import { t as IPOAccessCard } from "./ipo-access-card-emiBZrFo.mjs";
import { t as NewsFeed } from "./news-feed-CCSmjtn0.mjs";
import { n as PortfolioChart, r as TerminalStatCard, t as HoldingsTable } from "./portfolio-chart-CVcq4KW3.mjs";
import { t as WatchlistTable } from "./watchlist-table-e_NU-EcC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/terminal-C97A_Wcg.js
var import_jsx_runtime = require_jsx_runtime();
function TerminalHome() {
	const d = getTerminalDashboard();
	const terminalDescription = getTerminalDescription();
	const watchlistGroups = getWatchlistGroups();
	const terminalIpoAccess = getTerminalIpoAccess();
	const terminalNews = getTerminalNews();
	const holdings = getHoldings();
	const orders = getOrders();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal",
		title: "Invest Like the 1%",
		description: terminalDescription,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Total Net Worth",
						value: florin(d.totalNetWorth),
						className: "lg:col-span-1"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Portfolio Value",
						value: florin(d.portfolioValue)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Daily P&L",
						value: `+${florin(d.dailyPnL)}`,
						sub: pct(d.dailyPnLPercent),
						accent: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalStatCard, {
						label: "Cash Available",
						value: florin(d.cashAvailable)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Portfolio Performance",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioChart, {
					data: d.performanceSeries,
					gradientId: "terminalHome"
				}) })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Open Orders",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "!p-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-5 py-3",
										children: "Order"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-5 py-3",
										children: "Side"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-5 py-3",
										children: "Symbol"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-5 py-3 text-right",
										children: "Qty"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-5 py-3",
										children: "Status"
									})
								]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: orders.filter((o) => o.status === "Working").map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border/50 last:border-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
										children: o.id
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: `px-5 py-3 font-mono text-[12px] ${o.side === "BUY" ? "ticker-up" : "ticker-down"}`,
										children: o.side
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-5 py-3 font-mono",
										children: o.symbol
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular px-5 py-3 text-right",
										children: o.qty
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-5 py-3 font-mono text-[11px] text-gold",
										children: o.status
									})
								]
							}, o.id)) })]
						})
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Watchlist Preview",
					action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/terminal/watchlist",
						className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
						children: "Full watchlist →"
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchlistTable, { items: watchlistGroups[0].items.slice(0, 4) })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Market Movers",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "Top Gainers"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-3",
						children: movers.gainers.slice(0, 5).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between border-b border-border/50 pb-3 last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: s.symbol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ticker-up font-mono text-[12px]",
								children: pct(s.change)
							})]
						}, s.symbol))
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "Top Losers"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 space-y-3",
						children: movers.losers.slice(0, 5).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between border-b border-border/50 pb-3 last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: s.symbol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ticker-down font-mono text-[12px]",
								children: pct(s.change)
							})]
						}, s.symbol))
					})] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "IPO Access Preview",
				className: "mt-10",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/terminal/ipo",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "IPO Access →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-3",
					children: terminalIpoAccess.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOAccessCard, {
						company: ipo.company,
						ticker: ipo.ticker,
						status: ipo.status,
						allocationStatus: ipo.allocationStatus,
						detail: ipo.offeringPrice ?? ipo.expectedPrice ?? ipo.listingPrice
					}, ipo.ticker))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Market News",
				className: "mt-10",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/terminal/news",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "All news →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsFeed, { items: terminalNews.slice(0, 4) })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Holdings Snapshot",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HoldingsTable, { rows: holdings.slice(0, 4) })
			})
		]
	});
}
//#endregion
export { TerminalHome as component };
