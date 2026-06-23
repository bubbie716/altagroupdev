import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell } from "./page-shell-B0Lrv62S.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-C-Bh7K80.mjs";
import { t as getCorporateActions } from "./filings-n5rHsr91.mjs";
import { t as CorporateActionTable } from "./corporate-action-table-BnP37Tlu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/actions-C5aCyyUV.js
var import_jsx_runtime = require_jsx_runtime();
var sections = [
	{
		title: "Dividends",
		filter: "dividends"
	},
	{
		title: "Stock Splits",
		filter: "splits"
	},
	{
		title: "Buybacks",
		filter: "buybacks"
	},
	{
		title: "Mergers",
		filter: "mergers"
	},
	{
		title: "Tender Offers",
		filter: "tenders"
	}
];
function ExchangeActions() {
	const corporateActions = getCorporateActions();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Corporate Actions",
		title: "Corporate Actions",
		description: "Dividends, splits, buybacks, mergers, and tender offers across Alta Exchange listed issuers — simulated data.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), sections.map((s) => {
			const rows = corporateActions.filter((a) => a.category === s.filter);
			if (rows.length === 0) return null;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: s.title,
				className: "mt-10 first:mt-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorporateActionTable, { actions: rows })
			}, s.title);
		})]
	});
}
//#endregion
export { ExchangeActions as component };
