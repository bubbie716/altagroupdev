import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn, r as Card } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/bank-stat-card-7UCf14uE.js
var import_jsx_runtime = require_jsx_runtime();
function BankStatCard({ label, value, sub, accent, className }) {
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
//#endregion
export { BankStatCard as t };
