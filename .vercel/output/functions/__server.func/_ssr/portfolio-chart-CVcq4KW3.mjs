import { a as makeSeries, n as florin, u as stocks } from "./mock-data-BOQymobG.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as cn } from "./site-nav-CiEv8NB3.mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
import { a as Area, i as XAxis, l as Tooltip, o as CartesianGrid, r as YAxis, t as AreaChart, u as ResponsiveContainer } from "../_libs/recharts+victory-vendor.mjs";
import { t as MiniChart } from "./mini-chart-D2f8DI-l.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portfolio-chart-CVcq4KW3.js
var import_jsx_runtime = require_jsx_runtime();
function TerminalStatCard({ label, value, sub, accent, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: cn("!p-5", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("tabular mt-2 text-xl font-semibold tracking-tight", accent && "text-[var(--success)]"),
				children: value
			}),
			sub && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 font-mono text-[10px] text-muted-foreground",
				children: sub
			})
		]
	});
}
function HoldingsTable({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "!p-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Symbol"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Shares"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Avg Cost"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Last"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Value"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "P&L"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Weight"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-5 py-3" })
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((h) => {
				const s = stocks.find((x) => x.symbol === h.symbol);
				const cost = h.shares * h.avg;
				const p = h.value - cost;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "px-5 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/exchange/company/$ticker",
								params: { ticker: h.symbol.toLowerCase() },
								className: "font-mono hover:text-gold",
								children: h.symbol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-[11px] text-muted-foreground",
								children: s.name
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "tabular px-5 py-3 text-right",
							children: h.shares.toLocaleString()
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "tabular px-5 py-3 text-right text-muted-foreground",
							children: h.avg.toFixed(2)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "tabular px-5 py-3 text-right",
							children: s.price.toFixed(2)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "tabular px-5 py-3 text-right",
							children: florin(h.value)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: `tabular px-5 py-3 text-right ${p >= 0 ? "ticker-up" : "ticker-down"}`,
							children: [p >= 0 ? "+" : "", florin(p)]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "tabular px-5 py-3 text-right text-muted-foreground",
							children: [(h.weight * 100).toFixed(1), "%"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "w-20 px-5 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniChart, {
								data: makeSeries(30, s.price, 1, .05),
								positive: s.change >= 0,
								height: 28
							})
						})
					]
				}, h.symbol);
			}) })]
		})
	});
}
function PortfolioChart({ data, gradientId = "terminalPortfolio", height = 280 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		style: { height },
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
			width: "100%",
			height: "100%",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
				data,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
						id: gradientId,
						x1: "0",
						x2: "0",
						y1: "0",
						y2: "1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "var(--gold)",
							stopOpacity: .28
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "var(--gold)",
							stopOpacity: 0
						})]
					}) }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
						stroke: "var(--border)",
						strokeDasharray: "2 4",
						vertical: false
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
						hide: true,
						dataKey: "t"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
						hide: true,
						domain: ["dataMin", "dataMax"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
						contentStyle: {
							background: "var(--surface-2)",
							border: "1px solid var(--border-strong)",
							borderRadius: 8,
							fontSize: 11
						},
						formatter: (v) => [florin(Number(v)), "Value"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
						type: "monotone",
						dataKey: "v",
						stroke: "var(--gold)",
						strokeWidth: 1.8,
						fill: `url(#${gradientId})`
					})
				]
			})
		})
	});
}
//#endregion
export { PortfolioChart as n, TerminalStatCard as r, HoldingsTable as t };
