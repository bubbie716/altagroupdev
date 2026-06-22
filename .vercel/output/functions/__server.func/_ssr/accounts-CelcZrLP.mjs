import { n as florin } from "./mock-data-BOQymobG.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-Czj8D5TM.mjs";
import { i as getBankAccounts } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-BwtTi5qG.mjs";
import { t as AccountCard } from "./account-card-BFlXFkVT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/accounts-CelcZrLP.js
var import_jsx_runtime = require_jsx_runtime();
function BankAccounts() {
	const bankAccounts = getBankAccounts();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Accounts",
		title: "Accounts",
		description: "Your Alta Bank account structure — personal, business, and private wealth positions. Simulated preview.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
				children: bankAccounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountCard, { account: a }, a.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "All Accounts",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "!p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Account"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Type"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Number"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Status"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Balance"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Recent Activity"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: bankAccounts.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-medium",
									children: a.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 text-muted-foreground",
									children: a.type
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[12px]",
									children: a.accountNumber
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[11px] text-[var(--success)]",
									children: a.status
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular px-5 py-3 text-right font-medium",
									children: florin(a.balance)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 text-[12px] text-muted-foreground",
									children: a.recentActivity
								})
							]
						}, a.id)) })]
					})
				})
			})
		]
	});
}
//#endregion
export { BankAccounts as component };
