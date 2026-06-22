import { o as __toESM } from "../_runtime.mjs";
import { c as pct, i as indexSeries, o as movers, t as compact, u as stocks } from "./mock-data-BOQymobG.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { u as ArrowUpRight } from "../_libs/lucide-react.mjs";
import { i as SiteNav, n as AltaWordmark, r as SiteFooter, t as AltaLogo } from "./site-nav-CiEv8NB3.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { a as Area, i as XAxis, l as Tooltip, o as CartesianGrid, r as YAxis, t as AreaChart, u as ResponsiveContainer } from "../_libs/recharts+victory-vendor.mjs";
import { t as getIndices } from "./indices-fmWAdCD4.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BD6eRO9q.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AnimatedNumber({ value, format = (n) => n.toLocaleString(), duration = 1200, className }) {
	const [v, setV] = (0, import_react.useState)(0);
	const start = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		let raf = 0;
		const tick = (t) => {
			if (start.current == null) start.current = t;
			const p = Math.min(1, (t - start.current) / duration);
			setV(value * (1 - Math.pow(1 - p, 3)));
			if (p < 1) raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [value, duration]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className,
		children: format(v)
	});
}
function Landing() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hero, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Marquee, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Divisions, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Capabilities, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClosingCTA, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteFooter, {})
		]
	});
}
function Hero() {
	const nsx100 = getIndices()[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "relative overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0",
				style: { background: "var(--gradient-hero)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-0 hero-grid" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative mx-auto max-w-[1400px] px-6 pt-32 pb-24",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
					initial: {
						opacity: 0,
						y: 20
					},
					animate: {
						opacity: 1,
						y: 0
					},
					transition: {
						duration: .8,
						ease: [
							.22,
							1,
							.36,
							1
						]
					},
					className: "flex flex-col items-center text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaLogo, { className: "h-16 w-16 text-foreground" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-[var(--success)]" }),
								"Alta Exchange Open · NSX-100 ",
								nsx100.value.toLocaleString(void 0, { minimumFractionDigits: 2 })
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-8 max-w-[20ch] text-[clamp(3.25rem,8vw,7rem)] font-semibold leading-[0.96] tracking-[-0.022em]",
							children: "Live Like the 1%"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-7 max-w-xl text-[17px] leading-relaxed text-muted-foreground",
							children: "The financial infrastructure company of Newport."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-10 flex flex-wrap items-center justify-center gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/terminal",
								className: "group inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px",
								children: ["Enter Platform", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/exchange",
								className: "inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-1/60 px-5 py-3 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2",
								children: "Explore Markets"
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
					initial: {
						opacity: 0,
						y: 40
					},
					animate: {
						opacity: 1,
						y: 0
					},
					transition: {
						duration: 1,
						delay: .3,
						ease: [
							.22,
							1,
							.36,
							1
						]
					},
					className: "relative mx-auto mt-20 max-w-[1180px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-2xl border border-border-strong bg-surface-1/90 p-2 shadow-[var(--shadow-elegant)] backdrop-blur",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardMockup, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "pointer-events-none absolute -inset-x-20 -bottom-20 -z-10 h-60",
						style: { background: "var(--shadow-glow)" }
					})]
				})]
			})
		]
	});
}
function DashboardMockup() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl bg-background p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-border pb-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaLogo, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Alta Portfolio · Snapshot"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "hidden gap-1 md:flex",
				children: [
					"1D",
					"1W",
					"1M",
					"3M",
					"1Y",
					"ALL"
				].map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: `rounded px-2 py-0.5 font-mono text-[10px] ${i === 3 ? "bg-surface-2 text-foreground" : "text-muted-foreground"}`,
					children: t
				}, t))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-5 pt-5 lg:grid-cols-[1.6fr_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-baseline gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
					children: "Net Worth"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tabular mt-1 text-3xl font-semibold tracking-tight",
					children: "ƒ8,412,209.40"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ticker-up tabular font-mono text-xs",
					children: "+ƒ142,802.10 · +1.72%"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 h-56",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
					width: "100%",
					height: "100%",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
						data: indexSeries,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
								id: "heroFill",
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
								labelStyle: { display: "none" },
								formatter: (v) => [Number(v).toFixed(2), "Value"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
								type: "monotone",
								dataKey: "v",
								stroke: "var(--gold)",
								strokeWidth: 1.8,
								fill: "url(#heroFill)"
							})
						]
					})
				})
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3",
				children: [[
					{
						l: "Florin Balance",
						v: "ƒ1,240,500"
					},
					{
						l: "Portfolio",
						v: "ƒ1,885,285"
					},
					{
						l: "Today's P&L",
						v: "+ƒ24,810",
						up: true
					},
					{
						l: "Exposure",
						v: "62.4%"
					}
				].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-lg border border-border bg-surface-1 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
						children: k.l
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `tabular mt-1.5 text-base font-semibold ${k.up ? "text-[var(--success)]" : ""}`,
						children: k.v
					})]
				}, k.l)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "col-span-2 rounded-lg border border-border bg-surface-1 p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
						children: "Top Movers"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 space-y-1.5",
						children: stocks.slice(0, 4).map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between text-[12px]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono",
								children: s.symbol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `tabular ${s.change >= 0 ? "ticker-up" : "ticker-down"}`,
								children: pct(s.change)
							})]
						}, s.symbol))
					})]
				})]
			})]
		})]
	});
}
function Marquee() {
	const items = [...getIndices().slice(0, 4).map((i) => ({
		symbol: i.symbol,
		name: i.name,
		value: i.value,
		change: i.change
	})), ...stocks.slice(0, 6).map((s) => ({
		symbol: s.symbol,
		name: s.name,
		value: s.price,
		change: s.change
	}))];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "border-y border-border bg-surface-1/50",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto flex max-w-[1400px] gap-10 overflow-hidden px-6 py-3 font-mono text-[11px]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex animate-[scroll_60s_linear_infinite] gap-10 whitespace-nowrap",
				children: [...items, ...items].map((it, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "inline-flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: it.symbol
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular text-foreground",
							children: it.value.toLocaleString()
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: it.change >= 0 ? "ticker-up" : "ticker-down",
							children: pct(it.change)
						})
					]
				}, i))
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `@keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }` })]
	});
}
function Divisions() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mx-auto max-w-[1400px] px-6 py-32",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid items-end gap-8 md:grid-cols-[1fr_auto] mb-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[11px] uppercase tracking-[0.24em] text-gold",
				children: "01 — Structure"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
				className: "mt-4 text-[clamp(2.25rem,4.4vw,3.75rem)] font-semibold leading-[1.0] tracking-[-0.018em]",
				children: [
					"Four divisions. ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-muted-foreground",
						children: "One financial architecture."
					})
				]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-sm text-[14px] leading-relaxed text-muted-foreground",
				children: "Banking, terminal, exchange, and clearing — operated as a single institution under unified governance."
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4",
			children: [
				{
					to: "/bank",
					name: "Alta Bank",
					headline: "Bank Like the 1%",
					tag: "01 · Banking",
					desc: "Personal banking, business accounts, deposits, lending, and treasury for Newport citizens, builders, and institutions.",
					services: [
						"Deposits",
						"Business Banking",
						"Lending",
						"Treasury Services"
					],
					metric: "ƒ62B deposits · 12,480 accounts"
				},
				{
					to: "/terminal",
					name: "Alta Terminal",
					headline: "Invest Like the 1%",
					tag: "02 · Terminal",
					desc: "Portfolio access, market data, watchlists, analytics, and order entry in one interface.",
					services: [
						"Portfolio Dashboard",
						"Market Data",
						"Watchlists",
						"Order Entry"
					],
					metric: "8,240 active users"
				},
				{
					to: "/exchange",
					name: "Alta Exchange",
					headline: "National Market Infrastructure",
					tag: "03 · Exchange",
					desc: "Listings, price discovery, trade execution, and market data for the Republic.",
					services: [
						"Listings",
						"Price Discovery",
						"Trade Execution",
						"Market Infrastructure"
					],
					metric: "184 listed companies"
				},
				{
					to: "/governance",
					name: "NCC",
					headline: "Clearing & Settlement Infrastructure",
					tag: "04 · Clearing",
					desc: "Planned settlement network for routing, wires, payment rails, account registry, and securities clearing.",
					services: [
						"Interbank Settlement",
						"Securities Clearing",
						"Account Registry",
						"Payment Network"
					],
					metric: "Planned · Future infrastructure"
				}
			].map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: d.to,
				className: "group relative flex flex-col bg-surface-1 p-7 transition-colors duration-300 hover:bg-surface-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
					initial: {
						opacity: 0,
						y: 16
					},
					whileInView: {
						opacity: 1,
						y: 0
					},
					viewport: {
						once: true,
						amount: .4
					},
					transition: {
						duration: .6,
						delay: i * .1,
						ease: [
							.22,
							1,
							.36,
							1
						]
					},
					className: "flex h-full flex-col",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
								children: d.tag
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-gold" })]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "mt-10 text-[26px] font-semibold tracking-tight",
							children: d.headline ?? d.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-[13.5px] leading-relaxed text-muted-foreground",
							children: d.desc
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mt-6 space-y-1.5",
							children: d.services.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-2 text-[12.5px] text-foreground/85",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-px w-3 bg-gold/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s })]
							}, s))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-auto pt-8 font-mono text-[10.5px] uppercase tracking-[0.18em] text-gold",
							children: d.metric
						})
					]
				})
			}, d.name))
		})]
	});
}
function Capabilities() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "border-y border-border bg-surface-1/40",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-border md:grid-cols-4",
			children: [
				{
					k: "ƒ62B",
					l: "Assets administered"
				},
				{
					k: "142",
					l: "Listed companies"
				},
				{
					k: "T+0",
					l: "Settlement cycle"
				},
				{
					k: "99.99%",
					l: "Platform uptime"
				}
			].map((it) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "bg-surface-1/50 px-6 py-12 text-center md:py-16",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-[clamp(2rem,3.5vw,3.5rem)] font-semibold tracking-tight",
					children: it.k
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
					children: it.l
				})]
			}, it.l))
		})
	});
}
function ClosingCTA() {
	const topMover = movers.gainers[0];
	const nsxIndex = getIndices()[0];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: "mx-auto max-w-[1400px] px-6 py-32",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative overflow-hidden rounded-2xl border border-border-strong bg-surface-1 p-12 md:p-20",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0",
				style: { background: "radial-gradient(circle at 80% 20%, oklch(0.32 0.072 264 / 0.4), transparent 60%)" }
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaWordmark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "mt-8 text-[clamp(2.25rem,4.8vw,4.25rem)] font-semibold leading-[1.0] tracking-[-0.018em]",
					children: [
						"Access the platform ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", {
							className: "not-italic text-gradient-gold",
							children: "trusted by the Republic."
						})
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col items-start gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
							children: "Live market snapshot"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "tabular text-2xl font-semibold tracking-tight text-foreground",
								children: [
									"NSX-100",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatedNumber, {
										value: nsxIndex.value,
										format: (n) => n.toLocaleString("en-US", {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2
										}),
										className: "text-[var(--success)]"
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--success)]",
								children: ["↗ ", pct(nsxIndex.change)]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								compact(topMover.marketCap),
								" top mover · ",
								topMover.symbol
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1 rounded-full bg-[var(--success)]/10 px-2.5 py-0.5 font-medium text-[var(--success)]",
								children: ["↗ ", pct(topMover.change)]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/terminal",
							className: "mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px",
							children: ["Enter Platform", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-4 w-4" })]
						})
					]
				})]
			})]
		})
	});
}
//#endregion
export { Landing as component };
