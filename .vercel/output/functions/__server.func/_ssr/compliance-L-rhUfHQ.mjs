import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, c as cn } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { l as getComplianceCases } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/compliance-L-rhUfHQ.js
var import_jsx_runtime = require_jsx_runtime();
var severityStyles = {
	Low: "bg-muted text-muted-foreground border-border",
	Medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
	High: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
	Critical: "bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/30"
};
function ComplianceBadge({ severity }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]", severityStyles[severity]),
		children: severity
	});
}
function InternalCompliance() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "Compliance",
		description: "Open cases, conduct flags, and escalation queue.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Compliance Cases",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
				columns: [
					{
						key: "id",
						header: "Case",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: c.id
						})
					},
					{
						key: "title",
						header: "Title",
						cell: (c) => c.title
					},
					{
						key: "category",
						header: "Category",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[12px] text-muted-foreground",
							children: c.category
						})
					},
					{
						key: "severity",
						header: "Severity",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComplianceBadge, { severity: c.severity })
					},
					{
						key: "status",
						header: "Status",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: c.status })
					},
					{
						key: "assignee",
						header: "Assignee",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: c.assignee
						})
					},
					{
						key: "opened",
						header: "Opened",
						cell: (c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: c.opened
						})
					},
					{
						key: "actions",
						header: "Actions",
						cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Open case" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Assign" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Resolve",
									variant: "primary"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Escalate",
									variant: "danger"
								})
							]
						})
					}
				],
				rows: getComplianceCases(),
				rowKey: (c) => c.id
			})
		})
	});
}
//#endregion
export { InternalCompliance as component };
