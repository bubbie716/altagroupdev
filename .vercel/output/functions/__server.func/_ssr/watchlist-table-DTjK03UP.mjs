import { a as makeSeries, c as pct, t as compact } from "./mock-data-BOQymobG.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-ZY9JEvww.mjs";
import { t as MiniChart } from "./mini-chart-D2f8DI-l.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watchlist-table-DTjK03UP.js
var import_jsx_runtime = require_jsx_runtime();
function WatchlistTable({ items, showAlerts = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "!p-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Ticker"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Company"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Sector"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Last"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Change"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Market Cap"
					}),
					showAlerts && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Alert"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "px-5 py-3" })
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: items.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/exchange/company/$ticker",
							params: { ticker: s.symbol.toLowerCase() },
							className: "font-mono hover:text-gold",
							children: s.symbol
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: s.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-muted-foreground",
						children: s.sector
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "tabular px-5 py-3 text-right",
						children: s.price.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: `tabular px-5 py-3 text-right ${s.change >= 0 ? "ticker-up" : "ticker-down"}`,
						children: pct(s.change)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
						className: "tabular px-5 py-3 text-right text-muted-foreground",
						children: ["ƒ", compact(s.marketCap)]
					}),
					showAlerts && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-[12px] text-muted-foreground",
						children: s.alert ?? "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "w-20 px-5 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniChart, {
							data: makeSeries(30, s.price, 1, .04),
							positive: s.change >= 0,
							height: 28
						})
					})
				]
			}, s.symbol)) })]
		})
	});
}
//#endregion
export { WatchlistTable as t };
