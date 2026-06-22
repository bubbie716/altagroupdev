import { n as florin } from "./mock-data-BOQymobG.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-Czj8D5TM.mjs";
import { a as Area, i as XAxis, l as Tooltip, o as CartesianGrid, r as YAxis, t as AreaChart, u as ResponsiveContainer } from "../_libs/recharts+victory-vendor.mjs";
import { a as getBankDashboard, i as getBankAccounts, m as getRecentActivity } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-BwtTi5qG.mjs";
import { t as AccountCard } from "./account-card-BFlXFkVT.mjs";
import { t as BankStatCard } from "./bank-stat-card-CKuLF3Et.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-CSpiUnAp.js
var import_jsx_runtime = require_jsx_runtime();
function TransactionTable({ rows, title = "Recent Activity" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "!p-0",
		children: [title && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Date"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Reference"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Description"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Category"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Amount"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
						children: t.date
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
						children: t.id
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3",
						children: t.desc
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-muted-foreground",
						children: t.category
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
						className: `tabular px-5 py-3 text-right font-medium ${t.amount >= 0 ? "ticker-up" : ""}`,
						children: [t.amount >= 0 ? "+" : "", florin(t.amount)]
					})
				]
			}, t.id)) })]
		})]
	});
}
function BankDashboard() {
	const d = getBankDashboard();
	const bankAccounts = getBankAccounts();
	const bankRecentActivity = getRecentActivity();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Client",
		title: "Financial Position",
		description: "Your Alta Bank balances, credit access, private status, and recent activity — simulated preview data.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "Total Relationship Value",
						value: florin(d.totalRelationshipValue),
						className: "md:col-span-2 lg:col-span-2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "Credit Available",
						value: florin(d.creditAvailable)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "Private Status",
						value: d.privateStatus,
						sub: "Alta Private member"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "Checking Balance",
						value: florin(d.checkingBalance)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "Savings Balance",
						value: florin(d.savingsBalance)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "Reserve Balance",
						value: florin(d.reserveBalance)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
						label: "MTD Change",
						value: "+2.14%",
						accent: true,
						sub: "Relationship assets"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Balance Trend",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-xl border border-border bg-surface-1/80 p-5 shadow-card",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-48",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
								data: d.balanceTrend,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
										id: "bankTrend",
										x1: "0",
										x2: "0",
										y1: "0",
										y2: "1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
											offset: "0%",
											stopColor: "var(--gold)",
											stopOpacity: .28
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
											offset: "100%",
											stopColor: "var(--gold)",
											stopOpacity: 0
										})]
									}) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
										stroke: "var(--border)",
										strokeDasharray: "2 4",
										vertical: false
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
										hide: true,
										dataKey: "t"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
										hide: true,
										domain: ["dataMin", "dataMax"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
										contentStyle: {
											background: "var(--surface-2)",
											border: "1px solid var(--border-strong)",
											borderRadius: 8,
											fontSize: 11
										},
										formatter: (v) => [florin(Number(v)), "Value"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "v",
										stroke: "var(--gold)",
										strokeWidth: 1.8,
										fill: "url(#bankTrend)"
									})
								]
							})
						})
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Account Overview",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
					children: bankAccounts.slice(0, 3).map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountCard, { account: a }, a.id))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Recent Activity",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TransactionTable, {
					rows: bankRecentActivity,
					title: ""
				})
			})
		]
	});
}
//#endregion
export { BankDashboard as component };
