import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell } from "./page-shell-B0Lrv62S.mjs";
import { d as getTerminalNews } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-CN6tJP6E.mjs";
import { t as NewsFeed } from "./news-feed-C_mAnH8V.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-BqnpmeKZ.js
var import_jsx_runtime = require_jsx_runtime();
var categories = [
	"All",
	"Market",
	"Company",
	"Exchange",
	"Bank",
	"Macro"
];
function TerminalNews() {
	const terminalNews = getTerminalNews();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · News",
		title: "Market News",
		description: "Market updates, company announcements, exchange notices, and macro headlines — simulated feed.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}), categories.map((cat, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: cat === "All" ? "All Headlines" : cat,
			className: i > 0 ? "mt-12" : void 0,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewsFeed, { items: cat === "All" ? terminalNews : terminalNews.filter((n) => n.category === cat) })
		}, cat))]
	});
}
//#endregion
export { TerminalNews as component };
