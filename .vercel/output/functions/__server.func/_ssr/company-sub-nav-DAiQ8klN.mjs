import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company-sub-nav-DAiQ8klN.js
var import_jsx_runtime = require_jsx_runtime();
function CompanySubNav({ companyId }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const base = `/companies/${companyId}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4",
		children: [
			{
				to: base,
				label: "Overview",
				exact: true
			},
			{
				to: `${base}/members`,
				label: "Members"
			},
			{
				to: `${base}/settings`,
				label: "Settings"
			}
		].map((l) => {
			const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: l.to,
				className: cn("rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors", active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"),
				children: l.label
			}, l.to);
		})
	});
}
//#endregion
export { CompanySubNav as t };
