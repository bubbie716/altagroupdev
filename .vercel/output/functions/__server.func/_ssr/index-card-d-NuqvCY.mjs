import { c as pct } from "./mock-data-BOQymobG.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
import { t as MiniChart } from "./mini-chart-D2f8DI-l.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/index-card-d-NuqvCY.js
var import_jsx_runtime = require_jsx_runtime();
function IndexCard({ index }) {
	const positive = index.change >= 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground",
					children: index.symbol
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[13px]",
					children: index.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
					children: [
						index.category,
						" · ",
						index.constituents,
						" constituents"
					]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `font-mono text-[12px] ${positive ? "ticker-up" : "ticker-down"}`,
				children: pct(index.change)
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "tabular mt-4 text-2xl font-semibold tracking-tight",
			children: index.value.toLocaleString(void 0, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 h-14",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniChart, {
				data: index.series,
				positive,
				height: 56
			})
		})
	] });
}
//#endregion
export { IndexCard as t };
