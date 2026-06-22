import { c as pct } from "./mock-data-BOQymobG.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-Czj8D5TM.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-DvNfa7Yt.mjs";
import { t as getMarketStats } from "./market-stats-C3ED_Sdd.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/rankings-DFE90G1b.js
var import_jsx_runtime = require_jsx_runtime();
function RankingTable({ title, rows, showChange = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "!p-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "#"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Ticker"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Company"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: showChange ? "Price" : "Value"
					}),
					showChange && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Change"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-muted-foreground",
						children: r.rank
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/exchange/company/$ticker",
							params: { ticker: r.ticker.toLowerCase() },
							className: "font-mono hover:text-gold",
							children: r.ticker
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: r.company
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "tabular px-5 py-3 text-right font-medium",
						children: r.value
					}),
					showChange && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: `tabular px-5 py-3 text-right ${(r.change ?? 0) >= 0 ? "ticker-up" : "ticker-down"}`,
						children: r.change != null ? pct(r.change) : "—"
					})
				]
			}, r.ticker)) })]
		})]
	});
}
function ExchangeRankings() {
	const r = getMarketStats().rankings;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Rankings",
		title: "Market Rankings",
		description: "Top gainers, losers, most active, and largest issuers on Alta Exchange — simulated session data.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Top Gainers",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankingTable, {
						title: "Top Gainers",
						rows: r.gainers,
						showChange: true
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Top Losers",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankingTable, {
						title: "Top Losers",
						rows: r.losers,
						showChange: true
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Most Active",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankingTable, {
						title: "Most Active",
						rows: r.mostActive
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Largest Companies",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankingTable, {
						title: "Largest Companies",
						rows: r.largest
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Highest Volume",
					className: "lg:col-span-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankingTable, {
						title: "Highest Volume",
						rows: r.highestVolume
					})
				})
			]
		})]
	});
}
//#endregion
export { ExchangeRankings as component };
