import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/corporate-action-table-DFmVrlKt.js
var import_jsx_runtime = require_jsx_runtime();
function CorporateActionTable({ actions }) {
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
						children: "Action"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Detail"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Date"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: actions.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono",
						children: a.ticker
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: a.company
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: a.type
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-muted-foreground",
						children: a.detail
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
						children: a.date
					})
				]
			}, `${a.ticker}-${a.type}-${a.date}`)) })]
		})
	});
}
//#endregion
export { CorporateActionTable as t };
