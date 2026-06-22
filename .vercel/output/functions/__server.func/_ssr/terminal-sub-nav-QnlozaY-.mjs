import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as cn } from "./site-nav-CiEv8NB3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/terminal-sub-nav-QnlozaY-.js
var import_jsx_runtime = require_jsx_runtime();
var links = [
	{
		to: "/terminal",
		label: "Overview",
		exact: true
	},
	{
		to: "/terminal/portfolio",
		label: "Portfolio"
	},
	{
		to: "/terminal/watchlist",
		label: "Watchlist"
	},
	{
		to: "/terminal/trade",
		label: "Trade"
	},
	{
		to: "/terminal/research",
		label: "Research"
	},
	{
		to: "/terminal/ipo",
		label: "IPO Access"
	},
	{
		to: "/terminal/news",
		label: "News"
	},
	{
		to: "/terminal/leaderboard",
		label: "Leaderboard"
	}
];
function TerminalSubNav() {
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
export { TerminalSubNav as t };
