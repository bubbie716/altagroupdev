import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { m as getIpoApplications } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ipos-B1HHu539.js
var import_jsx_runtime = require_jsx_runtime();
function InternalIpos() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "IPO Application Review",
		description: "Applications are tied to registered company entities. Review representatives and documentation before approval.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Applications",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
				columns: [
					{
						key: "id",
						header: "Ref",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: a.id
						})
					},
					{
						key: "company",
						header: "Company",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/internal/companies/$companyId",
							params: { companyId: a.companyId },
							className: "hover:text-gold",
							children: a.company
						})
					},
					{
						key: "ticker",
						header: "Ticker",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: a.ticker
						})
					},
					{
						key: "sector",
						header: "Sector",
						cell: (a) => a.sector
					},
					{
						key: "raise",
						header: "Raise",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular font-mono",
							children: a.raiseSize
						})
					},
					{
						key: "status",
						header: "App Status",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.status })
					},
					{
						key: "verification",
						header: "Co. Verification",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.companyVerificationStatus })
					},
					{
						key: "rep",
						header: "Authorized Rep.",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: a.authorizedRepresentative
						})
					},
					{
						key: "docs",
						header: "Documents",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.documentsReceived })
					},
					{
						key: "board",
						header: "Board Approval",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.boardApprovalStatus })
					},
					{
						key: "submitted",
						header: "Submitted",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: a.submitted
						})
					},
					{
						key: "actions",
						header: "Actions",
						cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Review" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Approve",
									variant: "primary"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Reject",
									variant: "danger"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Request info" })
							]
						})
					}
				],
				rows: getIpoApplications(),
				rowKey: (a) => a.id
			})
		})
	});
}
//#endregion
export { InternalIpos as component };
