import { a as formatCompanyRole } from "./permissions-DFFnJwMM.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { _ as ArrowUpRight } from "../_libs/lucide-react.mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as Route } from "./companies-D7zT-_eM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/companies-DF534amW.js
var import_jsx_runtime = require_jsx_runtime();
function CompanyDashboardCard({ company }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "flex flex-col !p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
						children: company.type
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-2 text-lg font-semibold tracking-tight",
						children: company.name
					}),
					company.sector && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[13px] text-muted-foreground",
						children: company.sector
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.status })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid gap-3 text-[13px] sm:grid-cols-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
						children: "Your role"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 font-medium",
						children: formatCompanyRole(company.role)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
						children: "Verification"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.verificationStatus })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
						children: "Ticker"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 font-mono text-[12px]",
						children: company.ticker ?? company.desiredTicker ?? "—"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
						children: "Registered"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 font-mono text-[11px] text-muted-foreground",
						children: company.createdAt.slice(0, 10)
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/companies/$companyId",
				params: { companyId: company.id },
				className: "mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
				children: ["View company", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3.5" })]
			})
		]
	});
}
function CompaniesDashboard() {
	const companies = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Account",
		title: "Companies & Institutions",
		description: "Registered entities you are authorized to represent. Companies do not log in directly — individuals act on their behalf through membership roles.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-8 flex justify-end",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/companies/create",
				className: "rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background",
				children: "Create company"
			})
		}), companies.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mx-auto max-w-lg !p-10 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.22em] text-gold",
					children: "No memberships"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold tracking-tight",
					children: "You are not connected to any companies yet."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground",
					children: "Register a company or institution to begin business banking, listing, issuer portal, and API workflows. You may belong to multiple companies with distinct roles."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/companies/create",
					className: "mt-8 inline-block rounded-md border border-border px-5 py-2.5 text-[13px] font-medium tracking-wide",
					children: "Create company"
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Your companies",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2",
				children: companies.map((company) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyDashboardCard, { company }, company.id))
			})
		})]
	});
}
//#endregion
export { CompaniesDashboard as component };
