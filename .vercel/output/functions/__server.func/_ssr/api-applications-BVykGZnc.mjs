import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { n as getApiApplications } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-applications-BVykGZnc.js
var import_jsx_runtime = require_jsx_runtime();
function InternalApiApplications() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "Exchange API Applications",
		description: "Review API access requests submitted by authorized representatives. Keys are issued to verified company entities — not to companies directly.",
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
						cell: (a) => a.companyId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/internal/companies/$companyId",
							params: { companyId: a.companyId },
							className: "hover:text-gold",
							children: a.company
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: a.organization
						})
					},
					{
						key: "applicant",
						header: "Applicant",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: a.applicant
						})
					},
					{
						key: "useCase",
						header: "Use Case",
						cell: (a) => a.useCase
					},
					{
						key: "tier",
						header: "Tier",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: a.apiTier
						})
					},
					{
						key: "scopes",
						header: "Scopes",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] leading-snug text-muted-foreground",
							children: a.scopes.join(", ")
						})
					},
					{
						key: "status",
						header: "Status",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.status })
					},
					{
						key: "verification",
						header: "Co. Verification",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.companyVerificationStatus })
					},
					{
						key: "keys",
						header: "Keys",
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular font-mono text-[11px]",
							children: a.keysIssued > 0 ? a.keysIssued : "—"
						})
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
						cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Review" }),
								a.status !== "Approved" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Approve",
									variant: "primary"
								}),
								a.status === "Approved" && a.keysIssued === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Issue key",
									variant: "primary"
								}),
								a.keysIssued > 0 && a.status !== "Revoked" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Revoke key",
									variant: "danger"
								}),
								a.status !== "Rejected" && a.status !== "Revoked" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Reject",
									variant: "danger"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Request info" })
							]
						})
					}
				],
				rows: getApiApplications(),
				rowKey: (a) => a.id
			})
		})
	});
}
//#endregion
export { InternalApiApplications as component };
