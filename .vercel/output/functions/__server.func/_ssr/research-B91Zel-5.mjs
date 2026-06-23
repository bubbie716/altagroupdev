import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell } from "./page-shell-B0Lrv62S.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-C-Bh7K80.mjs";
import { t as FilingCard } from "./filing-card-9hqP0LkD.mjs";
import { n as getFilings } from "./filings-n5rHsr91.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-B91Zel-5.js
var import_jsx_runtime = require_jsx_runtime();
var sections = [
	{
		title: "Market Commentary",
		filter: "commentary"
	},
	{
		title: "Company Filings",
		filter: "filings"
	},
	{
		title: "IPO Prospectuses",
		filter: "prospectuses"
	},
	{
		title: "Economic Reports",
		filter: "economic"
	},
	{
		title: "Exchange Notices",
		filter: "notices"
	}
];
function ExchangeResearch() {
	const researchDocuments = getFilings();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Research",
		title: "Research & Filings",
		description: "Market commentary, issuer filings, IPO prospectuses, and exchange notices — simulated document library.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), sections.map((s, i) => {
			const docs = researchDocuments.filter((d) => d.section === s.filter);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: s.title,
				className: i > 0 ? "mt-12" : void 0,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
					children: docs.map((doc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilingCard, { doc }, doc.title))
				})
			}, s.title);
		})]
	});
}
//#endregion
export { ExchangeResearch as component };
