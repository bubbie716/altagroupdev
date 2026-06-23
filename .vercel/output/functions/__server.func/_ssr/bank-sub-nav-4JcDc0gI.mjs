import { s as isPrivateClient } from "./permissions-DFFnJwMM.mjs";
import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn, l as useCurrentUser } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/bank-sub-nav-4JcDc0gI.js
var import_jsx_runtime = require_jsx_runtime();
var links = [
	{
		to: "/bank/dashboard",
		label: "Dashboard"
	},
	{
		to: "/bank/accounts",
		label: "Accounts"
	},
	{
		to: "/bank/transfers",
		label: "Transfers"
	},
	{
		to: "/bank/deposits",
		label: "Deposits"
	},
	{
		to: "/bank/lending",
		label: "Lending"
	},
	{
		to: "/bank/business",
		label: "Business"
	},
	{
		to: "/bank/private",
		label: "Private",
		privateOnly: true
	}
];
function BankSubNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const user = useCurrentUser();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4",
		children: links.filter((l) => !("privateOnly" in l && l.privateOnly) || user !== null && isPrivateClient(user)).map((l) => {
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
export { BankSubNav as t };
