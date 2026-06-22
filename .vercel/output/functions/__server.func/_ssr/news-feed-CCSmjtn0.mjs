import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/news-feed-CCSmjtn0.js
var import_jsx_runtime = require_jsx_runtime();
function NewsFeed({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "!p-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: items.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "border-b border-border/50 px-5 py-4 last:border-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[10px] uppercase tracking-[0.18em] text-gold",
						children: n.category
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] text-muted-foreground",
						children: n.date
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[11px] text-muted-foreground",
						children: ["· ", n.source]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[14px] leading-snug",
				children: n.headline
			})]
		}, n.headline)) })
	});
}
//#endregion
export { NewsFeed as t };
