import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { f as getTerminalResearch } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-CN6tJP6E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-DmZmKE5P.js
var import_jsx_runtime = require_jsx_runtime();
function ResearchCard({ title, category, date, issuer }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
				children: category
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-mono text-[10px] text-muted-foreground",
				children: date
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "mt-4 text-[15px] font-medium leading-snug tracking-tight",
			children: title
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-[13px] text-muted-foreground",
			children: issuer
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			disabled: true,
			className: "mt-5 cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
			children: "View"
		})
	] });
}
var filters = [
	"All",
	"Company Reports",
	"Market Notes",
	"Filings",
	"IPO Prospectuses",
	"Economic Reports"
];
function matchesFilter(item, filter) {
	if (filter === "All") return true;
	if (filter === "Company Reports") return item.category.includes("Company") || item.category.includes("Report");
	if (filter === "Market Notes") return item.category.includes("Market") || item.category.includes("Commentary");
	if (filter === "Filings") return item.category.includes("Filing");
	if (filter === "IPO Prospectuses") return item.category.includes("Prospectus") || item.category.includes("IPO");
	if (filter === "Economic Reports") return item.category.includes("Economic");
	return true;
}
function TerminalResearch() {
	const terminalResearch = getTerminalResearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · Research",
		title: "Research",
		description: "Company reports, market notes, exchange filings, and economic research — simulated document library.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-8 flex flex-wrap gap-2",
				children: [filters.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `rounded-md px-3 py-1.5 text-[12px] tracking-wide ${i === 0 ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"}`,
					children: f
				}, f)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "search",
					placeholder: "Search research…",
					className: "ml-auto w-full max-w-xs rounded-md border border-border bg-surface-2/50 px-3 py-1.5 text-sm text-muted-foreground md:w-64",
					disabled: true
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Research Library",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
					children: terminalResearch.filter((r) => matchesFilter(r, "All")).map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchCard, {
						title: r.title,
						category: r.category,
						date: r.date,
						issuer: r.issuer
					}, r.title))
				})
			})
		]
	});
}
//#endregion
export { TerminalResearch as component };
