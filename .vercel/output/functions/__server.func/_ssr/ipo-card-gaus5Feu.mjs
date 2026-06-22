import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ipo-card-gaus5Feu.js
var import_jsx_runtime = require_jsx_runtime();
function IPOCard({ ipo }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[11px] uppercase tracking-[0.22em] text-gold",
				children: ipo.ticker
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-2 text-lg font-semibold tracking-tight",
				children: ipo.company
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: ipo.status
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
			className: "mt-5 grid gap-3 text-sm sm:grid-cols-2",
			children: [
				ipo.offeringPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Offering Price"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium",
					children: ipo.offeringPrice
				})] }),
				ipo.expectedPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Expected Price"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium",
					children: ipo.expectedPrice
				})] }),
				ipo.sharesOffered && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Shares Offered"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium",
					children: ipo.sharesOffered
				})] }),
				ipo.raiseSize && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Raise Size"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium",
					children: ipo.raiseSize
				})] }),
				ipo.listingPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Listing Price"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium",
					children: ipo.listingPrice
				})] }),
				ipo.currentPrice && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Current Price"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium",
					children: ipo.currentPrice
				})] }),
				ipo.returnSinceListing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
					className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "Return Since Listing"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
					className: "tabular mt-1 font-medium ticker-up",
					children: ipo.returnSinceListing
				})] })
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: true,
					className: "cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
					children: "View Prospectus"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: true,
					className: "cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
					children: "Indicate Interest"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: true,
					className: "cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
					children: "View Listing"
				})
			]
		})
	] });
}
//#endregion
export { IPOCard as t };
