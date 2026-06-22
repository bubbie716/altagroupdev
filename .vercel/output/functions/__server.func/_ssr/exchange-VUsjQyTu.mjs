import { c as pct, i as indexSeries } from "./mock-data-BOQymobG.mjs";
import { t as getCompanies } from "./companies-D1cM1agJ.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-Czj8D5TM.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-DvNfa7Yt.mjs";
import { t as FilingCard } from "./filing-card-BDYUv-a3.mjs";
import { a as Area, i as XAxis, l as Tooltip, o as CartesianGrid, r as YAxis, t as AreaChart, u as ResponsiveContainer } from "../_libs/recharts+victory-vendor.mjs";
import { n as getFilings, t as getCorporateActions } from "./filings-n5rHsr91.mjs";
import { t as CorporateActionTable } from "./corporate-action-table-DFmVrlKt.mjs";
import { t as getIndices } from "./indices-fmWAdCD4.mjs";
import { t as getIPOs } from "./ipos-BLQkR1mp.mjs";
import { t as getMarketStats } from "./market-stats-C3ED_Sdd.mjs";
import { t as CompanyTable } from "./company-table-B2Xjpj1h.mjs";
import { t as IndexCard } from "./index-card-d-NuqvCY.mjs";
import { t as IPOCard } from "./ipo-card-gaus5Feu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/exchange-VUsjQyTu.js
var import_jsx_runtime = require_jsx_runtime();
function ExchangeOverview() {
	const market = getMarketStats();
	const snap = market.snapshot;
	const companies = getCompanies();
	const indices = getIndices();
	const ipos = getIPOs();
	const filings = getFilings();
	const actions = getCorporateActions();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange",
		title: "The national venue of the Republic.",
		description: "Alta Exchange operates Newport's primary market infrastructure for listings, price discovery, execution, and market data.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Market Snapshot",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-6 lg:grid-cols-[1.6fr_1fr]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-mono text-[11px] uppercase tracking-[0.22em] text-gold",
								children: snap.index.symbol
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "tabular mt-2 text-4xl font-semibold tracking-tight",
								children: snap.index.value.toLocaleString(void 0, { minimumFractionDigits: 2 })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "ticker-up mt-1 font-mono text-[12px]",
								children: ["+114.62 · ", pct(snap.index.change)]
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "text-right",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
								children: "Status"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--success)]/30 px-2.5 py-1 text-[11px]",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-mono uppercase tracking-wide text-[var(--success)]",
									children: [
										snap.status,
										" · ",
										snap.time
									]
								})]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 h-[280px]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
								data: indexSeries,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
										id: "nsxFill",
										x1: "0",
										x2: "0",
										y1: "0",
										y2: "1",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
											offset: "0%",
											stopColor: "var(--gold)",
											stopOpacity: .3
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
										dataKey: "t",
										tickLine: false,
										axisLine: false,
										stroke: "var(--muted-foreground)",
										fontSize: 10
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
										tickLine: false,
										axisLine: false,
										stroke: "var(--muted-foreground)",
										fontSize: 10
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
										background: "var(--surface-2)",
										border: "1px solid var(--border-strong)",
										borderRadius: 8,
										fontSize: 11
									} }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "v",
										stroke: "var(--gold)",
										strokeWidth: 1.8,
										fill: "url(#nsxFill)"
									})
								]
							})
						})
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
						children: "Exchange Statistics"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
						className: "mt-4 divide-y divide-border/60 text-sm",
						children: market.stats.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between py-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
								className: "text-muted-foreground",
								children: s.label
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
								className: "tabular font-mono text-[12px]",
								children: s.value
							})]
						}, s.label))
					})] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Listed Companies",
				className: "mt-12",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/listings",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "View all →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyTable, { companies: companies.slice(0, 6) })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Indices",
				className: "mt-12",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/indices",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "All indices →"
				}),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground",
					children: "NSX indices are benchmark products calculated and published on Alta Exchange."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
					children: indices.slice(0, 3).map((idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IndexCard, { index: idx }, idx.symbol))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "IPO Center Preview",
				className: "mt-12",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/ipo",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "IPO Center →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-3",
					children: ipos.map((ipo) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IPOCard, { ipo }, ipo.ticker))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Corporate Actions Preview",
				className: "mt-12",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/actions",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "All actions →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorporateActionTable, { actions: actions.slice(0, 5) })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Research & Filings Preview",
				className: "mt-12",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/research",
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "Research library →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
					children: filings.slice(0, 3).map((doc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilingCard, { doc }, doc.title))
				})
			})
		]
	});
}
//#endregion
export { ExchangeOverview as component };
