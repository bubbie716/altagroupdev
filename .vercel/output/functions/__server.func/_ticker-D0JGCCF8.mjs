import { c as pct, n as florin, t as compact } from "./_ssr/mock-data-BOQymobG.mjs";
import { n as getCompany, t as getCompanies } from "./_ssr/companies-D1cM1agJ.mjs";
import { g as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "./_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Route } from "./_ticker-CQicEQKz.mjs";
import { n as PageShell, r as Section, t as Card } from "./_ssr/page-shell-ZY9JEvww.mjs";
import { t as ExchangeSubNav } from "./_ssr/exchange-sub-nav-hxQSS5wy.mjs";
import { t as FilingCard } from "./_ssr/filing-card-7_HtvtK3.mjs";
import { a as Area, i as XAxis, l as Tooltip, o as CartesianGrid, r as YAxis, t as AreaChart, u as ResponsiveContainer } from "./_libs/recharts+victory-vendor.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_ticker-D0JGCCF8.js
var import_jsx_runtime = require_jsx_runtime();
var announcementsByTicker = {
	NPC: [
		{
			id: "npc-1",
			ticker: "NPC",
			date: "2026-06-22",
			title: "Harbor District refining capacity expansion",
			body: "Newport Petroleum Corp. confirms a phased expansion of refining capacity at the Harbor District facility, with commissioning targeted for Q1 2027.",
			type: "corporate"
		},
		{
			id: "npc-2",
			ticker: "NPC",
			date: "2026-06-01",
			title: "May 2026 Financial Update",
			body: "Monthly operating metrics and consolidated financial summary for the period ended May 31, 2026.",
			type: "financial",
			attachment: {
				name: "NPC_May_2026_Financial_Update.pdf",
				size: "2.4 MB"
			}
		},
		{
			id: "npc-3",
			ticker: "NPC",
			date: "2026-05-01",
			title: "April 2026 Financial Update",
			body: "Monthly operating metrics and consolidated financial summary for the period ended April 30, 2026.",
			type: "financial",
			attachment: {
				name: "NPC_April_2026_Financial_Update.pdf",
				size: "2.2 MB"
			}
		}
	],
	ALTB: [{
		id: "altb-1",
		ticker: "ALTB",
		date: "2026-06-18",
		title: "Q2 deposit growth update",
		body: "Alta Bank Holdings reports consolidated deposit growth of 4.2% quarter-to-date across retail and business segments.",
		type: "corporate"
	}, {
		id: "altb-2",
		ticker: "ALTB",
		date: "2026-06-01",
		title: "May 2026 Financial Update",
		body: "Monthly financial summary for Alta Bank Holdings and consolidated banking subsidiaries.",
		type: "financial",
		attachment: {
			name: "ALTB_May_2026_Financial_Update.pdf",
			size: "1.8 MB"
		}
	}],
	MRDN: [{
		id: "mrdn-1",
		ticker: "MRDN",
		date: "2026-06-10",
		title: "Meridian Logistics hub expansion",
		body: "Meridian Logistics announces the opening of a new intermodal hub at Meridian Industrial Park.",
		type: "corporate"
	}, {
		id: "mrdn-2",
		ticker: "MRDN",
		date: "2026-06-01",
		title: "May 2026 Financial Update",
		body: "Monthly freight volumes, revenue per shipment, and consolidated financial summary.",
		type: "financial",
		attachment: {
			name: "MRDN_May_2026_Financial_Update.pdf",
			size: "1.6 MB"
		}
	}],
	AURM: [{
		id: "aurm-1",
		ticker: "AURM",
		date: "2026-06-15",
		title: "Production guidance reaffirmed",
		body: "Aurum Mining Trust reaffirms full-year production guidance following Q2 operational review.",
		type: "corporate"
	}, {
		id: "aurm-2",
		ticker: "AURM",
		date: "2026-06-01",
		title: "May 2026 Financial Update",
		body: "Monthly production report and consolidated financial summary.",
		type: "financial",
		attachment: {
			name: "AURM_May_2026_Financial_Update.pdf",
			size: "1.5 MB"
		}
	}],
	ELRA: [{
		id: "elra-1",
		ticker: "ELRA",
		date: "2026-06-19",
		title: "Phase III candidate regulatory update",
		body: "Elara Pharmaceuticals receives Republic FDA-equivalent approval to proceed with Phase III trials.",
		type: "corporate"
	}]
};
function fallbackAnnouncements(ticker, companyName) {
	return [{
		id: `${ticker.toLowerCase()}-fb-1`,
		ticker,
		date: "2026-06-15",
		title: `${companyName} publishes operating update`,
		body: `${companyName} has published its latest operating update to Alta Exchange investors.`,
		type: "corporate"
	}];
}
/** GET /v1/companies/:ticker/announcements */
function getAnnouncements(ticker) {
	const sym = ticker.toUpperCase();
	if (announcementsByTicker[sym]) return announcementsByTicker[sym];
	const company = getCompanies().find((c) => c.symbol === sym);
	if (!company) return [];
	return fallbackAnnouncements(sym, company.name);
}
function CompanyProfileHeader({ company }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-xl border border-border bg-surface-1 p-6 shadow-card",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-mono text-[11px] uppercase tracking-[0.24em] text-gold",
					children: [
						company.symbol,
						" · ",
						company.exchange
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-2 text-2xl font-semibold tracking-tight",
					children: company.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
					children: [
						company.sector,
						" · ",
						company.status
					]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "text-right",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "tabular text-3xl font-semibold tracking-tight",
					children: florin(company.price)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `mt-1 font-mono text-[13px] ${company.change >= 0 ? "ticker-up" : "ticker-down"}`,
					children: pct(company.change)
				})]
			})]
		})
	});
}
function KeyStatsGrid({ stats }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3",
		children: stats.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "bg-surface-1 px-5 py-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
				children: s.label
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tabular mt-1 text-[15px] font-medium",
				children: s.value
			})]
		}, s.label))
	});
}
function CompanyMetaGrid({ items }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
		className: "grid gap-4 sm:grid-cols-2",
		children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
			className: "font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground",
			children: item.label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
			className: "mt-1 text-[14px]",
			children: item.value
		})] }, item.label))
	}) });
}
function CorporateAnnouncementList({ announcements }) {
	if (announcements.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-[13px] text-muted-foreground",
		children: "No corporate announcements published."
	}) });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "!p-0",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: announcements.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "border-b border-border/50 px-5 py-4 last:border-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-mono text-[11px] text-muted-foreground",
						children: a.date
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: `rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${a.type === "financial" ? "bg-gold/10 text-gold" : "bg-surface-2 text-muted-foreground"}`,
						children: a.type === "financial" ? "Financial Update" : "Corporate"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 text-[15px] font-medium",
					children: a.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] leading-relaxed text-muted-foreground",
					children: a.body
				}),
				a.attachment && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 inline-flex items-center gap-2 rounded-md border border-border/60 bg-surface-2/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: a.attachment.name }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground/60",
							children: "·"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: a.attachment.size })
					]
				})
			]
		}, a.id)) })
	});
}
function CompanyProfilePage() {
	const { ticker } = Route.useParams();
	const company = getCompany(ticker);
	if (!company) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange",
		title: "Company Not Found",
		description: "No listing found for this ticker.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted-foreground",
			children: "Ticker not found in Alta Exchange listings."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/exchange/listings",
			className: "mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-gold",
			children: "← Back to listings"
		})] })]
	});
	const announcements = getAnnouncements(ticker);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Company Profile",
		title: company.name,
		description: company.description,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyProfileHeader, { company }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/company/$ticker/owner",
					params: { ticker: company.symbol.toLowerCase() },
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "Issuer portal →"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Price Chart",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-[280px]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
							width: "100%",
							height: "100%",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
								data: company.priceSeries,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
										id: "coFill",
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
										formatter: (v) => [florin(Number(v)), "Price"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
										type: "monotone",
										dataKey: "v",
										stroke: "var(--gold)",
										strokeWidth: 1.8,
										fill: "url(#coFill)"
									})
								]
							})
						})
					}) })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyMetaGrid, { items: [
					{
						label: "Market Cap",
						value: `ƒ${compact(company.marketCap)}`
					},
					{
						label: "Volume",
						value: compact(company.volume)
					},
					{
						label: "Shares Outstanding",
						value: compact(company.sharesOutstanding)
					},
					{
						label: "CEO / Founder",
						value: company.ceo
					},
					{
						label: "Headquarters",
						value: company.headquarters
					},
					{
						label: "Exchange",
						value: company.exchange
					}
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Key Stats",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyStatsGrid, { stats: company.keyStats })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Corporate Announcements",
				className: "mt-10",
				action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/exchange/company/$ticker/owner",
					params: { ticker: company.symbol.toLowerCase() },
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "Issuer portal →"
				}),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CorporateAnnouncementList, { announcements })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Top Shareholders",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "!p-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Holder"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Ownership"
								})]
							}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: company.shareholders.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border/50 last:border-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3",
									children: h.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "tabular px-5 py-3 text-right",
									children: [h.pct.toFixed(1), "%"]
								})]
							}, h.name)) })]
						})
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Corporate Actions",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-4",
						children: company.corporateActions.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "border-b border-border/50 pb-3 last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-medium",
								children: a.action
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1 text-[13px] text-muted-foreground",
								children: a.detail
							})]
						}, a.action))
					}) })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Corporate Filings",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: company.filings.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilingCard, { doc: {
						title: f.title,
						category: f.type,
						date: f.date,
						issuer: company.name,
						section: "filings"
					} }, f.title))
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Recent News",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "!p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: company.news.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "border-b border-border/50 px-5 py-4 last:border-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[11px] text-muted-foreground",
							children: n.date
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1 text-[14px]",
							children: n.headline
						})]
					}, n.headline)) })
				})
			})
		]
	});
}
//#endregion
export { CompanyProfilePage as component };
