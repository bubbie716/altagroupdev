import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-ZY9JEvww.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-hxQSS5wy.mjs";
import { t as getIPOs } from "./ipos-BLQkR1mp.mjs";
import { t as IPOCard } from "./ipo-card-BUQQXv3k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ipo-B7a-K8lu.js
var import_jsx_runtime = require_jsx_runtime();
function ExchangeIPO() {
	const open = getIPOs("open");
	const upcoming = getIPOs("upcoming");
	const recent = getIPOs("recent");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · IPO Center",
		title: "IPO Center",
		description: "Primary market offerings, bookbuilding, and recently listed issuers on Alta Exchange — simulated preview.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "mb-10 border-gold/30 bg-gold/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "IPO participation is simulated in this preview."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Open IPOs",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: open.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOCard, { ipo }, ipo.ticker))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Upcoming IPOs",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: upcoming.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOCard, { ipo }, ipo.ticker))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Recently Listed",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: recent.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOCard, { ipo }, ipo.ticker))
				})
			})
		]
	});
}
//#endregion
export { ExchangeIPO as component };
