import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn, i as PageShell } from "./page-shell-B0Lrv62S.mjs";
import { C as internalPreviewNotice } from "./api-CbUtwIPv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/internal-page-shell-MM5TikUI.js
var import_jsx_runtime = require_jsx_runtime();
function InternalPreviewBanner() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mb-6 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-mono text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400",
			children: internalPreviewNotice
		})
	});
}
var links = [
	{
		to: "/internal",
		label: "Overview",
		exact: true
	},
	{
		to: "/internal/users",
		label: "Users"
	},
	{
		to: "/internal/companies",
		label: "Companies",
		match: "/internal/companies"
	},
	{
		to: "/internal/bank",
		label: "Bank Ops"
	},
	{
		to: "/internal/exchange",
		label: "Exchange Ops"
	},
	{
		to: "/internal/ipos",
		label: "IPO Applications"
	},
	{
		to: "/internal/api-applications",
		label: "API Applications"
	},
	{
		to: "/internal/listings",
		label: "Listings"
	},
	{
		to: "/internal/terminal",
		label: "Terminal Activity"
	},
	{
		to: "/internal/compliance",
		label: "Compliance"
	},
	{
		to: "/internal/settings",
		label: "Settings"
	}
];
function InternalSubNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-4",
		children: links.map((l) => {
			const active = "exact" in l && l.exact ? pathname === l.to : "match" in l ? pathname.startsWith(l.match) : pathname.startsWith(l.to);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: l.to,
				className: cn("rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors", active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"),
				children: l.label
			}, l.to);
		})
	});
}
function InternalPageShell({ title, description, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Internal",
		title,
		description,
		hideFooter: true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPreviewBanner, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalSubNav, {}),
			children
		]
	});
}
//#endregion
export { InternalPageShell as t };
