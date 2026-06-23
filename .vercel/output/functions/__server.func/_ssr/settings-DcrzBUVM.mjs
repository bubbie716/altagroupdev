import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { f as getInternalSettings } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-DcrzBUVM.js
var import_jsx_runtime = require_jsx_runtime();
function InternalSettingsPage() {
	const s = getInternalSettings();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
		title: "Internal Settings",
		description: "System configuration and feature flags — simulated controls only.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "System Configuration",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "grid gap-4 md:grid-cols-2 !p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Maintenance mode"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							disabled: true,
							className: "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s.maintenanceMode ? "Enabled" : "Disabled" })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Market status"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							disabled: true,
							className: "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s.marketStatus })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Bank transfers"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							disabled: true,
							className: "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s.bankTransfers })
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "IPO applications"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							disabled: true,
							className: "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { children: s.ipoApplications })
						})]
					})
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Feature Flags",
			className: "mt-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "!p-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Flag"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Key"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Status"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: s.featureFlags.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border/50 last:border-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: f.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 font-mono text-[11px] text-muted-foreground",
								children: f.key
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: f.enabled ? "Active" : "Suspended" })
							})
						]
					}, f.key)) })]
				})
			})
		})]
	});
}
//#endregion
export { InternalSettingsPage as component };
