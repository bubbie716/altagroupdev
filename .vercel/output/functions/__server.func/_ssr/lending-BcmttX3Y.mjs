import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-ZY9JEvww.mjs";
import { u as getLendingProducts } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-Ds51rrCr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/lending-BcmttX3Y.js
var import_jsx_runtime = require_jsx_runtime();
function BankLending() {
	const lendingProducts = getLendingProducts();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Lending",
		title: "Lending",
		description: "Credit facilities for Newport citizens, founders, and institutions — subject to standard underwriting review.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2",
				children: lendingProducts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[10px] uppercase tracking-[0.22em] text-gold",
							children: p.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: p.status
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid grid-cols-2 gap-4 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
							children: "Limit"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "tabular mt-1 font-medium",
							children: p.limit
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
							children: "Rate"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "tabular mt-1 font-medium",
							children: p.rate
						})] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-[13px] leading-relaxed text-muted-foreground",
						children: p.summary
					})
				] }, p.name))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Standby Liquidity",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[14px] leading-relaxed text-muted-foreground",
					children: "Alta Bank offers personal and business credit lines, with standby liquidity facilities available through Alta Private. Terms vary by product. All lending shown is simulated."
				}) })
			})
		]
	});
}
//#endregion
export { BankLending as component };
