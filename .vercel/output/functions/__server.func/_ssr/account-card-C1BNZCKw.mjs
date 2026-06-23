import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { r as Card } from "./page-shell-B0Lrv62S.mjs";
import { n as florin } from "./mock-data-BOQymobG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/account-card-C1BNZCKw.js
var import_jsx_runtime = require_jsx_runtime();
function AccountCard({ account }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "group cursor-default",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: account.product
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `font-mono text-[9px] uppercase tracking-[0.18em] ${account.status === "Active" ? "text-[var(--success)]" : "text-muted-foreground"}`,
					children: account.status
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-5 text-base font-medium tracking-tight",
				children: account.name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 font-mono text-[11px] text-muted-foreground",
				children: account.accountNumber
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tabular mt-4 text-2xl font-semibold tracking-tight",
				children: florin(account.balance)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground",
				children: account.recentActivity
			})
		]
	});
}
//#endregion
export { AccountCard as t };
