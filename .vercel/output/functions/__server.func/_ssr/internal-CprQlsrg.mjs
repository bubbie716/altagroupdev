import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { _ as getRecentAdminActivity, g as getOverviewMetrics, v as getSystemStatus } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as InternalStatCard } from "./internal-stat-card-aLHMOm0x.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/internal-CprQlsrg.js
var import_jsx_runtime = require_jsx_runtime();
function AdminActivityFeed({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "!p-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-4 py-3",
						children: "Time"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-4 py-3",
						children: "Actor"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-4 py-3",
						children: "Action"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-4 py-3",
						children: "Target"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-4 py-3",
						children: "Division"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: items.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-4 py-3 font-mono text-[11px] text-muted-foreground",
						children: a.timestamp
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-4 py-3 font-mono text-[12px]",
						children: a.actor
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-4 py-3",
						children: a.action
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-4 py-3 font-mono text-[12px] text-muted-foreground",
						children: a.target
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-4 py-3 font-mono text-[11px]",
						children: a.division
					})
				]
			}, a.id)) })]
		})
	});
}
function InternalOverview() {
	const m = getOverviewMetrics();
	const activity = getRecentAdminActivity();
	const systems = getSystemStatus();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
		title: "Operations Overview",
		description: "Cross-division metrics and system status for Alta Group staff.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Total Users",
						value: m.totalUsers.toLocaleString()
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Registered Companies",
						value: String(m.registeredCompanies)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Verified Institutions",
						value: String(m.verifiedInstitutions)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Authorized Representatives",
						value: String(m.authorizedRepresentatives)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Pending Company Reviews",
						value: String(m.pendingCompanyReviews),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Active Bank Accounts",
						value: m.activeBankAccounts.toLocaleString()
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Pending IPO Applications",
						value: String(m.pendingIpoApplications),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Pending API Applications",
						value: String(m.pendingApiApplications),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Active API Keys",
						value: String(m.activeApiKeys)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Listed Companies",
						value: String(m.listedCompanies)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Open Compliance Flags",
						value: String(m.openComplianceFlags),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Settlement Volume (24h)",
						value: m.settlementVolume,
						sub: "Simulated T+0"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "System Status",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 md:grid-cols-2 lg:grid-cols-3",
					children: systems.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "!p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] uppercase tracking-[0.14em]",
								children: s.service
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: s.status })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[12px] text-muted-foreground",
							children: s.detail
						})]
					}, s.service))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Recent Admin Activity",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminActivityFeed, { items: activity })
			})
		]
	});
}
//#endregion
export { InternalOverview as component };
