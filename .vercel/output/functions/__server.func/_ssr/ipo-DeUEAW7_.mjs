import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { u as getTerminalIpoAccess } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-CN6tJP6E.mjs";
import { t as IPOAccessCard } from "./ipo-access-card-B444kHQa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ipo-DeUEAW7_.js
var import_jsx_runtime = require_jsx_runtime();
function TerminalIPO() {
	const terminalIpoAccess = getTerminalIpoAccess();
	const open = terminalIpoAccess.filter((i) => i.stage === "open");
	const upcoming = terminalIpoAccess.filter((i) => i.stage === "upcoming");
	const recent = terminalIpoAccess.filter((i) => i.stage === "recent");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · IPO Access",
		title: "IPO Access",
		description: "Track open offerings, upcoming listings, and allocation status on Alta Exchange — simulated preview.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "mb-10 border-gold/30 bg-gold/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "IPO participation and allocation are simulated in this preview. No subscriptions are processed."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Open IPOs",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: open.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOAccessCard, {
						company: ipo.company,
						ticker: ipo.ticker,
						status: ipo.status,
						allocationStatus: ipo.allocationStatus,
						detail: `Offering ${ipo.offeringPrice} · Raise ${ipo.raiseSize}`
					}, ipo.ticker))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Upcoming IPOs",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: upcoming.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOAccessCard, {
						company: ipo.company,
						ticker: ipo.ticker,
						status: ipo.status,
						allocationStatus: ipo.allocationStatus,
						detail: `Expected ${ipo.expectedPrice}`
					}, ipo.ticker))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Recently Listed",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: recent.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOAccessCard, {
						company: ipo.company,
						ticker: ipo.ticker,
						status: ipo.status,
						allocationStatus: ipo.allocationStatus,
						detail: `Listed ${ipo.listingPrice} · Now ${ipo.currentPrice} (${ipo.returnSinceListing})`
					}, ipo.ticker))
				})
			})
		]
	});
}
//#endregion
export { TerminalIPO as component };
