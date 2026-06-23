import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { o as getDepositProducts } from "./api-BMHYd9JH.mjs";
import { t as BankSubNav } from "./bank-sub-nav-4JcDc0gI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/deposits-CRBZAVvc.js
var import_jsx_runtime = require_jsx_runtime();
function ProductCard({ product }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "font-mono text-[10px] uppercase tracking-[0.22em] text-gold",
		children: product.name
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4 grid gap-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
				children: "Minimum balance"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tabular mt-1 font-medium",
				children: product.minimumBalance
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
				children: "Best for"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 leading-relaxed text-muted-foreground",
				children: product.bestFor
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-1.5 border-t border-border/60 pt-3",
				children: product.benefits.map((b) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center gap-2 text-[13px] text-foreground/90",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px w-3 bg-gold/70" }), b]
				}, b))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: product.availability
			})
		]
	})] });
}
function BankDeposits() {
	const depositProducts = getDepositProducts();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Deposits",
		title: "Deposit Products",
		description: "Florin-denominated deposit accounts from Alta Access through Private Negotiated CDs — the deposit platform for Newport.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Product Suite",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
				children: depositProducts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductCard, { product: p }, p.name))
			})
		})]
	});
}
//#endregion
export { BankDeposits as component };
