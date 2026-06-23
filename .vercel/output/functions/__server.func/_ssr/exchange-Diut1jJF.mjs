import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { d as getExchangeOpsSummary, g as getOverviewMetrics, u as getExchangeListings } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
import { t as InternalStatCard } from "./internal-stat-card-aLHMOm0x.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/exchange-Diut1jJF.js
var import_jsx_runtime = require_jsx_runtime();
function InternalExchange() {
	const s = getExchangeOpsSummary();
	const m = getOverviewMetrics();
	const listings = getExchangeListings();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
		title: "Exchange Operations",
		description: "Listings, trading status, corporate actions, and API usage.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Listed Companies",
						value: String(s.listedCompanies)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Securities Halted",
						value: String(s.securitiesHalted),
						alert: s.securitiesHalted > 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Pending Corporate Actions",
						value: String(s.pendingCorporateActions)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Active Notices",
						value: String(s.activeNotices)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "API Keys Active",
						value: String(s.apiKeysActive)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Pending API Applications",
						value: String(m.pendingApiApplications),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "API Calls (24h)",
						value: s.dailyApiCalls
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Market Notices",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "space-y-3 !p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-border/50 pb-3 text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "NSX-100 quarterly rebalance — effective 2026-07-01" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Open" })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "MRDN trading halt — pending disclosure review" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Halted" })]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Listed Companies — Trading Status",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
					columns: [
						{
							key: "ticker",
							header: "Ticker",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: r.ticker
							})
						},
						{
							key: "company",
							header: "Company",
							cell: (r) => r.company
						},
						{
							key: "sector",
							header: "Sector",
							cell: (r) => r.sector
						},
						{
							key: "price",
							header: "Last",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular font-mono",
								children: r.lastPrice
							})
						},
						{
							key: "status",
							header: "Trading",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.tradingStatus })
						},
						{
							key: "actions",
							header: "Actions",
							cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Halt security",
										variant: "danger"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Publish notice" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Review action" })
								]
							})
						}
					],
					rows: listings,
					rowKey: (r) => r.ticker
				})
			})
		]
	});
}
//#endregion
export { InternalExchange as component };
