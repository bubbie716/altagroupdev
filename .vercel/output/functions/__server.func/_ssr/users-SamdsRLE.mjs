import { o as formatUserTag } from "./permissions-DFFnJwMM.mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { p as getInternalUsers } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as formatCompanyRole } from "./format-CN_yXT9F.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/users-SamdsRLE.js
var import_jsx_runtime = require_jsx_runtime();
function InternalUsers() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "User Management",
		description: "Individual users authenticate via Discord (future). Company access is granted through authorized representative memberships.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Users",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
				columns: [
					{
						key: "username",
						header: "Username",
						cell: (u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono",
							children: u.username
						})
					},
					{
						key: "discord",
						header: "Discord ID",
						cell: (u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: u.discordId
						})
					},
					{
						key: "mc",
						header: "Minecraft",
						cell: (u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[12px]",
							children: u.minecraftUsername
						})
					},
					{
						key: "tags",
						header: "Tags",
						cell: (u) => u.tags.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: "—"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: u.tags.map(formatUserTag).join(", ")
						})
					},
					{
						key: "companies",
						header: "Linked Companies",
						cell: (u) => u.companyMemberships.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: "—"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[12px] leading-snug",
							children: u.companyMemberships.map((m) => m.companyName).join(", ")
						})
					},
					{
						key: "companyRoles",
						header: "Company Roles",
						cell: (u) => u.companyMemberships.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: "—"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px]",
							children: u.companyMemberships.map((m) => formatCompanyRole(m.role)).join(", ")
						})
					},
					{
						key: "repStatus",
						header: "Rep. Status",
						cell: (u) => {
							if (u.companyMemberships.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "None" });
							const primary = u.companyMemberships[0].representativeStatus;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: primary });
						}
					},
					{
						key: "status",
						header: "Account",
						cell: (u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: u.accountStatus })
					},
					{
						key: "active",
						header: "Last Active",
						cell: (u) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: u.lastActive
						})
					},
					{
						key: "actions",
						header: "Actions",
						cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "View" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Flag" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Freeze",
									variant: "danger"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Promote",
									variant: "primary"
								})
							]
						})
					}
				],
				rows: getInternalUsers(),
				rowKey: (u) => u.id
			})
		})
	});
}
//#endregion
export { InternalUsers as component };
