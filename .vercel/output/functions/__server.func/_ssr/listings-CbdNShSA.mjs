import { t as getCompanies } from "./companies-D1cM1agJ.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section } from "./page-shell-ZY9JEvww.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-hxQSS5wy.mjs";
import { t as CompanyTable } from "./company-table-04Gw1h8c.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/listings-CbdNShSA.js
var import_jsx_runtime = require_jsx_runtime();
function ExchangeListings() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Listings",
		title: "Listed Companies",
		description: "184 Florin-denominated issuers listed on Alta Exchange — simulated market data.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "All Listings",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyTable, { companies: getCompanies() })
		})]
	});
}
//#endregion
export { ExchangeListings as component };
