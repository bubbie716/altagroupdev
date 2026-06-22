import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as ChartLine, i as Coins, l as Building2, r as Landmark, s as Check } from "../_libs/lucide-react.mjs";
import { i as SiteNav, r as SiteFooter, t as AltaLogo } from "./site-nav-C-b1VkXL.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { r as Section, t as Card } from "./page-shell-ZY9JEvww.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/governance-B41q3mky.js
var import_jsx_runtime = require_jsx_runtime();
var divisions = [
	{
		icon: Landmark,
		name: "Alta Bank",
		code: "ALT-BNK",
		tagline: "Bank Like the 1%",
		role: "Banking division",
		desc: "Personal banking, business accounts, deposits, lending, and treasury for Newport citizens, builders, and institutions.",
		services: [
			"Deposits",
			"Business Banking",
			"Lending",
			"Treasury Services"
		],
		stats: [
			{
				k: "Accounts",
				v: "12,480"
			},
			{
				k: "Deposits",
				v: "ƒ62B"
			},
			{
				k: "Status",
				v: "Active"
			}
		],
		status: "Operational"
	},
	{
		icon: ChartLine,
		name: "Alta Terminal",
		code: "ALT-TRM",
		tagline: "Invest Like the 1%",
		role: "Portfolio & market interface",
		desc: "Portfolio access, market data, watchlists, analytics, and order entry in one interface.",
		services: [
			"Portfolio Dashboard",
			"Market Data",
			"Watchlists",
			"Order Entry"
		],
		stats: [
			{
				k: "Users",
				v: "8,240"
			},
			{
				k: "Assets viewed",
				v: "ƒ12.4B"
			},
			{
				k: "Status",
				v: "Active"
			}
		],
		status: "Operational"
	},
	{
		icon: Building2,
		name: "Alta Exchange",
		code: "ALT-EXC",
		role: "National market venue",
		desc: "Listings, price discovery, trade execution, and market data for the Republic.",
		services: [
			"Listings",
			"Price Discovery",
			"Trade Execution",
			"Market Infrastructure"
		],
		stats: [
			{
				k: "Listings",
				v: "184"
			},
			{
				k: "Market cap",
				v: "ƒ428B"
			},
			{
				k: "Status",
				v: "Open"
			}
		],
		status: "Operational"
	},
	{
		icon: Coins,
		name: "NCC",
		code: "NCC",
		role: "Newport Clearing Corporation",
		desc: "Planned settlement network for routing, wires, payment rails, account registry, and securities clearing.",
		services: [
			"Interbank Settlement",
			"Securities Clearing",
			"Account Registry",
			"Payment Network"
		],
		stats: [
			{
				k: "Network",
				v: "NCC-Net"
			},
			{
				k: "Coverage",
				v: "Republic-wide"
			},
			{
				k: "Status",
				v: "Planned"
			}
		],
		status: "Planned"
	}
];
function Governance() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto max-w-[1400px] px-6 pt-14",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
					initial: {
						opacity: 0,
						y: 8
					},
					animate: {
						opacity: 1,
						y: 0
					},
					transition: {
						duration: .6,
						ease: [
							.22,
							1,
							.36,
							1
						]
					},
					className: "border-b border-border/60 pb-12",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[11px] uppercase tracking-[0.24em] text-gold",
							children: "Governance"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-5 text-[clamp(3.25rem,8vw,6.5rem)] font-semibold uppercase leading-[0.92] tracking-[-0.02em]",
							children: "Alta Group"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-foreground",
							children: "Live Like the 1%"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-muted-foreground",
							children: "Corporate Structure & Governance"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground",
							children: "A single parent holding company — Alta Group N.V. — operating the regulated entities that constitute the financial infrastructure of the Republic of Newport."
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "py-12",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-6 lg:grid-cols-3 mb-12",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
										children: "Entity"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 text-2xl font-semibold tracking-tight",
										children: "Alta Group N.V."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 text-sm font-medium tracking-tight text-foreground",
										children: "Live Like the 1%"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
										children: "Financial Infrastructure Holding"
									})
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
									children: "Mandate"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 text-sm leading-relaxed",
									children: "Operate banking, terminal, exchange, and clearing infrastructure for the Republic of Newport under unified governance."
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
									children: "Disclosures"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 text-xs leading-relaxed text-muted-foreground",
									children: "All figures simulated for the Newport roleplay economy. Florin-denominated. Not a real-money venue."
								})] })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
							title: "Group hierarchy",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "paper-grain relative rounded-2xl border border-border-strong bg-surface-1/70 p-12 shadow-elevated md:p-16",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-col items-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
											initial: {
												opacity: 0,
												y: 8
											},
											animate: {
												opacity: 1,
												y: 0
											},
											transition: { duration: .5 },
											className: "flex items-center gap-6 rounded-xl border border-border-strong bg-surface-2 px-12 py-7 shadow-elevated",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaLogo, { className: "h-12 w-12" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "text-[28px] font-semibold uppercase tracking-[0.06em] leading-none",
												children: ["Alta Group ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-muted-foreground",
													children: "N.V."
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-gold",
												children: "Parent · Financial Infrastructure Holding"
											})] })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative my-10 h-20 w-full",
											children: [
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-1/2 top-0 h-10 w-px -translate-x-1/2 bg-border-strong" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-[12.5%] right-[12.5%] top-10 h-px bg-border-strong" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-[12.5%] top-10 h-10 w-px bg-border-strong" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-[37.5%] top-10 h-10 w-px bg-border-strong" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-[62.5%] top-10 h-10 w-px bg-border-strong" }),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute left-[87.5%] top-10 h-10 w-px bg-border-strong" })
											]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "grid w-full gap-6 md:grid-cols-2 lg:grid-cols-4",
											children: divisions.map((d, i) => {
												const Icon = d.icon;
												const reserved = d.status !== "Operational";
												return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
													initial: {
														opacity: 0,
														y: 12
													},
													animate: {
														opacity: 1,
														y: 0
													},
													transition: {
														duration: .5,
														delay: .1 + i * .08
													},
													className: `group flex h-full min-h-[24rem] flex-col rounded-xl border border-border bg-background/80 p-8 shadow-card transition-all duration-300 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-elevated ${reserved ? "opacity-85" : ""}`,
													children: [
														/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
															className: "flex items-start justify-between",
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
																className: "flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-gold",
																children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" })
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
																className: "flex flex-col items-end gap-1",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
																	children: d.code
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
																	className: `font-mono text-[9px] uppercase tracking-[0.2em] ${reserved ? "text-muted-foreground" : "text-[var(--success)]"}`,
																	children: d.status
																})]
															})]
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "mt-7 text-xl font-semibold tracking-tight",
															children: d.name
														}),
														"tagline" in d && d.tagline ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "mt-2 text-sm font-medium tracking-tight text-foreground",
															children: d.tagline
														}) : null,
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
															children: d.role
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
															className: "mt-7 space-y-3 border-t border-border/60 pt-5",
															children: d.services.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
																className: "flex items-center gap-2 text-[13px] leading-relaxed text-foreground/90",
																children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
																	className: "size-3 shrink-0 text-gold",
																	strokeWidth: 2.5
																}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s })]
															}, s))
														}),
														/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
															className: "mt-7 grid grid-cols-3 gap-4 border-t border-border/60 pt-6",
															children: d.stats.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
																className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
																children: s.k
															}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
																className: "mt-1 font-mono text-[11px] tabular",
																children: s.v
															})] }, s.k))
														})
													]
												}, d.code);
											})
										})
									]
								})
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
							title: "Institutional Footprint",
							className: "mt-12",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4",
								children: [
									{
										k: "Accounts served",
										v: "12,480"
									},
									{
										k: "Deposits held",
										v: "ƒ62B"
									},
									{
										k: "Listed securities",
										v: "184"
									},
									{
										k: "Exchange market cap",
										v: "ƒ428B"
									},
									{
										k: "Private clients",
										v: "312"
									},
									{
										k: "Business accounts",
										v: "1,842"
									},
									{
										k: "Daily settlement volume",
										v: "ƒ4.2B"
									},
									{
										k: "Payment network",
										v: "NCC Planned"
									}
								].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "bg-surface-1 p-5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
										children: f.k
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 font-mono text-[13px] tabular",
										children: f.v
									})]
								}, f.k))
							})
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
//#endregion
export { Governance as component };
