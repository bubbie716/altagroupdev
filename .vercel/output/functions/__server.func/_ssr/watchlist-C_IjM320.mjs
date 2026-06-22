import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-Czj8D5TM.mjs";
import { m as getWatchlistGroups } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-QnlozaY-.mjs";
import { t as WatchlistTable } from "./watchlist-table-e_NU-EcC.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watchlist-C_IjM320.js
var import_jsx_runtime = require_jsx_runtime();
function TerminalWatchlist() {
	const watchlistGroups = getWatchlistGroups();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · Watchlist",
		title: "Watchlist",
		description: "Saved companies, price alerts, and watchlist groups — simulated preview data.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "mb-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[14px] text-muted-foreground",
					children: "Monitor Alta Exchange listed companies across grouped watchlists."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: true,
					className: "cursor-not-allowed rounded-md border border-border px-5 py-2.5 text-[13px] font-medium text-muted-foreground",
					children: "Add to Watchlist (preview only)"
				})]
			}),
			watchlistGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: group.name,
				className: "mt-10 first:mt-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchlistTable, {
					items: group.items,
					showAlerts: group.name === "Core Positions"
				})
			}, group.name))
		]
	});
}
//#endregion
export { TerminalWatchlist as component };
