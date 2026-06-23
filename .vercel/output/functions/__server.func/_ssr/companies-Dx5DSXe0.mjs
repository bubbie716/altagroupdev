import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
import { t as Route } from "./companies-DEwAYn0Y.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/companies-Dx5DSXe0.js
var import_jsx_runtime = require_jsx_runtime();
function InternalCompanies() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "Company & Institution Accounts",
		description: "Registered entities on Alta. Companies do not log in directly — authorized representatives act on their behalf.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Registered Entities",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
				columns: [
					{
						key: "name",
						header: "Company",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/internal/companies/$companyId",
							params: { companyId: c.id },
							className: "font-medium hover:text-gold",
							children: c.name
						})
					},
					{
						key: "ticker",
						header: "Ticker",
						cell: (c) => c.ticker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: c.ticker
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: "—"
						})
					},
					{
						key: "type",
						header: "Type",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[12px]",
							children: c.type
						})
					},
					{
						key: "sector",
						header: "Sector",
						cell: (c) => c.sector ?? "—"
					},
					{
						key: "status",
						header: "Status",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: c.status })
					},
					{
						key: "reps",
						header: "Representatives",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular font-mono",
							children: c.representativeCount
						})
					},
					{
						key: "contact",
						header: "Primary Contact",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[12px]",
							children: c.primaryContact
						})
					},
					{
						key: "verification",
						header: "Verification",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: c.verificationStatus })
					},
					{
						key: "updated",
						header: "Last Updated",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: c.lastUpdated
						})
					},
					{
						key: "actions",
						header: "Actions",
						cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "View" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Verify",
									variant: "primary"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Suspend",
									variant: "danger"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Add rep" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Request docs" })
							]
						})
					}
				],
				rows: Route.useLoaderData(),
				rowKey: (c) => c.id
			})
		})
	});
}
//#endregion
export { InternalCompanies as component };
