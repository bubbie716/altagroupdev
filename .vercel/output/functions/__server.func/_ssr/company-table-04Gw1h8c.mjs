import { c as pct, t as compact } from "./mock-data-BOQymobG.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-ZY9JEvww.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company-table-04Gw1h8c.js
var import_jsx_runtime = require_jsx_runtime();
function CompanyTable({ companies }) {
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
						children: "Last Price"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Daily Change"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Market Cap"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Volume"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Status"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Issuer"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: companies.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/exchange/company/$ticker",
							params: { ticker: c.symbol.toLowerCase() },
							className: "font-mono font-medium hover:text-gold",
							children: c.symbol
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/exchange/company/$ticker",
							params: { ticker: c.symbol.toLowerCase() },
							className: "hover:text-gold",
							children: c.name
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-muted-foreground",
						children: c.sector
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "tabular px-5 py-3 text-right",
						children: c.price.toFixed(2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: `tabular px-5 py-3 text-right ${c.change >= 0 ? "ticker-up" : "ticker-down"}`,
						children: pct(c.change)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
						className: "tabular px-5 py-3 text-right text-muted-foreground",
						children: ["ƒ", compact(c.marketCap)]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "tabular px-5 py-3 text-right text-muted-foreground",
						children: compact(c.volume)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-[11px] text-[var(--success)]",
						children: c.status
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/exchange/company/$ticker/owner",
							params: { ticker: c.symbol.toLowerCase() },
							className: "font-mono text-[11px] uppercase tracking-[0.14em] text-gold hover:underline",
							children: "Portal →"
						})
					})
				]
			}, c.symbol)) })]
		})
	});
}
//#endregion
export { CompanyTable as t };
