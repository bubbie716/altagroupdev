import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-ZY9JEvww.mjs";
import { c as getBusinessServices, s as getBusinessMetrics } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-Ds51rrCr.mjs";
import { t as BankStatCard } from "./bank-stat-card-DuVS5g-b.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/business-DZwNAgoW.js
var import_jsx_runtime = require_jsx_runtime();
function BankBusiness() {
	const businessMetrics = getBusinessMetrics();
	const businessServices = getBusinessServices();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Business",
		title: "Business Banking",
		description: "The institutional banking platform for Newport companies, founders, and corporate treasury desks.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-5",
				children: businessMetrics.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
					label: m.label,
					value: m.value
				}, m.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3",
				children: businessServices.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
						children: s.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-[14px] leading-relaxed text-muted-foreground",
						children: s.desc
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-gold",
						children: s.metric
					})
				] }, s.name))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Institutional Coverage",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[14px] leading-relaxed text-muted-foreground",
					children: "Alta Bank business clients receive dedicated coverage, multi-entity cash management, and integrated access to Alta Terminal and Alta Exchange infrastructure. Wire settlement routes through NCC-Net — planned clearing infrastructure for Newport interbank transfers."
				}) })
			})
		]
	});
}
//#endregion
export { BankBusiness as component };
