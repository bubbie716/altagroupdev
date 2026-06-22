import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as cn } from "./site-nav-C-b1VkXL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/exchange-sub-nav-hxQSS5wy.js
var import_jsx_runtime = require_jsx_runtime();
var links = [
	{
		to: "/exchange",
		label: "Overview",
		exact: true
	},
	{
		to: "/exchange/listings",
		label: "Listings"
	},
	{
		to: "/exchange/ipo",
		label: "IPO Center"
	},
	{
		to: "/exchange/apply",
		label: "List a Company"
	},
	{
		to: "/exchange/actions",
		label: "Corporate Actions"
	},
	{
		to: "/exchange/indices",
		label: "Indices"
	},
	{
		to: "/exchange/research",
		label: "Research"
	},
	{
		to: "/exchange/rankings",
		label: "Rankings"
	},
	{
		to: "/exchange/api",
		label: "API"
	}
];
function ExchangeSubNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4",
		children: links.map((l) => {
			const active = l.exact ? pathname === l.to : pathname === l.to || pathname.startsWith(`${l.to}/`);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: l.to,
				className: cn("rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors", active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"),
				children: l.label
			}, l.to);
		})
	});
}
//#endregion
export { ExchangeSubNav as t };
