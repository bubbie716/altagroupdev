import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section } from "./page-shell-Czj8D5TM.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-DvNfa7Yt.mjs";
import { t as getIndices } from "./indices-fmWAdCD4.mjs";
import { t as IndexCard } from "./index-card-d-NuqvCY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/indices-c7ouAZeW.js
var import_jsx_runtime = require_jsx_runtime();
function ExchangeIndices() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Indices",
		title: "Market Indices",
		description: "NSX benchmark indices calculated and published on Alta Exchange — simulated market data.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-8 max-w-2xl text-[14px] leading-relaxed text-muted-foreground",
				children: "NSX indices are market products on Alta Exchange. Alta Exchange is the institution; NSX is the index family used for benchmarking Republic equities."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "NSX Index Suite",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
					children: getIndices().map((idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndexCard, { index: idx }, idx.symbol))
				})
			})
		]
	});
}
//#endregion
export { ExchangeIndices as component };
