import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell } from "./page-shell-B0Lrv62S.mjs";
import { t as getCompanies } from "./companies-D1cM1agJ.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-C-Bh7K80.mjs";
import { t as CompanyTable } from "./company-table-B-dSVAY8.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/listings-DOAgHcCV.js
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
