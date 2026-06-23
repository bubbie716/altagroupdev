import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { h as getListingRecords } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/listings-BLLr1TLA.js
var import_jsx_runtime = require_jsx_runtime();
function InternalListings() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "Listed Company Management",
		description: "Active listings, filings, and compliance posture.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Listings",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
				columns: [
					{
						key: "ticker",
						header: "Ticker",
						cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: l.ticker
						})
					},
					{
						key: "company",
						header: "Company",
						cell: (l) => l.company
					},
					{
						key: "sector",
						header: "Sector",
						cell: (l) => l.sector
					},
					{
						key: "mcap",
						header: "Market Cap",
						cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular font-mono",
							children: l.marketCap
						})
					},
					{
						key: "status",
						header: "Status",
						cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: l.status })
					},
					{
						key: "filing",
						header: "Last Filing",
						cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: l.lastFiling
						})
					},
					{
						key: "compliance",
						header: "Compliance",
						cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: l.complianceStatus })
					},
					{
						key: "actions",
						header: "Actions",
						cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "View profile" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Suspend",
									variant: "danger"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Request filing" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Edit listing" })
							]
						})
					}
				],
				rows: getListingRecords(),
				rowKey: (l) => l.ticker
			})
		})
	});
}
//#endregion
export { InternalListings as component };
