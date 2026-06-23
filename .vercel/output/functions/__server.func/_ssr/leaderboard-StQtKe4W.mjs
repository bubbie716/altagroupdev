import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { n as getLeaderboard } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-CN6tJP6E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/leaderboard-StQtKe4W.js
var import_jsx_runtime = require_jsx_runtime();
function LeaderboardTable({ title, rows, showChange = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "!p-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "#"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Name"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: showChange ? "Price" : "Value"
					}),
					showChange && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Change"
					}),
					!showChange && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Detail"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-muted-foreground",
						children: r.rank
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-medium",
						children: r.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "tabular px-5 py-3 text-right",
						children: r.value
					}),
					showChange && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: `tabular px-5 py-3 text-right ${(r.change ?? 0) >= 0 ? "ticker-up" : "ticker-down"}`,
						children: r.change != null ? `${r.change > 0 ? "+" : ""}${r.change.toFixed(2)}%` : "—"
					}),
					!showChange && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-muted-foreground",
						children: r.detail ?? "—"
					})
				]
			}, r.rank)) })]
		})]
	});
}
function TerminalLeaderboard() {
	const lb = getLeaderboard();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · Leaderboard",
		title: "Investor Leaderboard",
		description: "Largest portfolios, daily performance, and market activity across Alta Terminal clients — simulated rankings.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Largest Portfolios",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardTable, {
						title: "Largest Portfolios",
						rows: lb.largestPortfolios.map((r) => ({
							rank: r.rank,
							name: r.name,
							value: r.value,
							detail: r.detail
						}))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Best Daily Performance",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardTable, {
						title: "Best Daily Performance",
						rows: lb.bestDaily.map((r) => ({
							rank: r.rank,
							name: r.name,
							value: r.value,
							detail: r.detail
						}))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Most Active Investors",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardTable, {
						title: "Most Active",
						rows: lb.mostActive.map((r) => ({
							rank: r.rank,
							name: r.name,
							value: r.value,
							detail: r.detail
						}))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Top Private Clients",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardTable, {
						title: "Top Private Clients",
						rows: lb.topPrivate.map((r) => ({
							rank: r.rank,
							name: r.name,
							value: r.value,
							detail: r.detail
						}))
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Biggest Winners",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardTable, {
						title: "Winners",
						rows: lb.winners.map((r) => ({
							rank: r.rank,
							name: `${r.ticker} · ${r.name}`,
							value: r.value,
							change: r.change
						})),
						showChange: true
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Biggest Losers",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeaderboardTable, {
						title: "Losers",
						rows: lb.losers.map((r) => ({
							rank: r.rank,
							name: `${r.ticker} · ${r.name}`,
							value: r.value,
							change: r.change
						})),
						showChange: true
					})
				})
			]
		})]
	});
}
//#endregion
export { TerminalLeaderboard as component };
