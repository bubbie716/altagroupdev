import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ipo-access-card-emiBZrFo.js
var import_jsx_runtime = require_jsx_runtime();
function IPOAccessCard({ company, ticker, status, allocationStatus, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[11px] uppercase tracking-[0.22em] text-gold",
				children: ticker
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-2 text-lg font-semibold tracking-tight",
				children: company
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: status
			})]
		}),
		detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-[13px] text-muted-foreground",
			children: detail
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
			children: ["Allocation: ", allocationStatus]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 flex flex-wrap gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: true,
				className: "cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
				children: "Indicate Interest"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: true,
				className: "cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
				children: "View Prospectus"
			})]
		})
	] });
}
//#endregion
export { IPOAccessCard as t };
