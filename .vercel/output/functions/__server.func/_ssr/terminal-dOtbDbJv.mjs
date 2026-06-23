import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { S as getTerminalWatchlistTrends, b as getTerminalOpenOrders, x as getTerminalTopViewed, y as getTerminalActivitySummary } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
import { t as InternalStatCard } from "./internal-stat-card-aLHMOm0x.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/terminal-dOtbDbJv.js
var import_jsx_runtime = require_jsx_runtime();
function InternalTerminal() {
	const s = getTerminalActivitySummary();
	const orders = getTerminalOpenOrders();
	const topViewed = getTerminalTopViewed();
	const watchlist = getTerminalWatchlistTrends();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
		title: "Terminal Activity",
		description: "Simulated order flow, research usage, and watchlist trends.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Active Users (24h)",
						value: String(s.activeUsers24h)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Open Orders",
						value: String(s.openOrders)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Research Views (24h)",
						value: s.researchViews24h.toLocaleString()
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Watchlist Adds (24h)",
						value: String(s.watchlistAdds24h)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Most Viewed Companies",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "!p-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-3",
									children: "Symbol"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-3 text-right",
									children: "Views"
								})]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: topViewed.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border/50 last:border-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3 font-mono",
									children: r.symbol
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular px-4 py-3 text-right font-mono",
									children: r.views
								})]
							}, r.symbol)) })]
						})
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Watchlist Trends",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "!p-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "Symbol"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "Adds"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "Note"
									})
								]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: watchlist.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border/50 last:border-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-4 py-3 font-mono",
										children: r.symbol
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "tabular px-4 py-3 font-mono",
										children: r.adds
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-4 py-3 text-muted-foreground",
										children: r.label
									})
								]
							}, r.symbol)) })]
						})
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Open Mock Orders",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
					columns: [
						{
							key: "id",
							header: "Order",
							cell: (o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: o.id
							})
						},
						{
							key: "user",
							header: "User",
							cell: (o) => o.user
						},
						{
							key: "symbol",
							header: "Symbol",
							cell: (o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: o.symbol
							})
						},
						{
							key: "side",
							header: "Side",
							cell: (o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: o.side === "BUY" ? "ticker-up font-mono" : "ticker-down font-mono",
								children: o.side
							})
						},
						{
							key: "qty",
							header: "Qty",
							cell: (o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular",
								children: o.qty
							})
						},
						{
							key: "status",
							header: "Status",
							cell: (o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: o.status })
						},
						{
							key: "time",
							header: "Time",
							cell: (o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] text-muted-foreground",
								children: o.time
							})
						}
					],
					rows: orders,
					rowKey: (o) => o.id
				})
			})
		]
	});
}
//#endregion
export { InternalTerminal as component };
