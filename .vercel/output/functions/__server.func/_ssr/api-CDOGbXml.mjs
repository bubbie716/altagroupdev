import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, l as useCurrentUser, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-C-Bh7K80.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-CDOGbXml.js
var import_jsx_runtime = require_jsx_runtime();
function ApiEndpointCard({ endpoint, baseUrl }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "!p-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded bg-[var(--success)]/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--success)]",
				children: endpoint.method
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("code", {
				className: "font-mono text-[13px] text-foreground",
				children: [baseUrl, endpoint.path]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3 px-5 py-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[14px] leading-relaxed text-muted-foreground",
					children: endpoint.summary
				}),
				endpoint.params && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
					children: "Parameters"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 font-mono text-[12px] text-foreground/80",
					children: endpoint.params
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-6 border-t border-border/40 pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
						children: "Mock function"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "mt-1 block font-mono text-[12px] text-gold",
						children: endpoint.mockFn
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
						children: "Response"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "mt-1 block font-mono text-[12px] text-foreground/80",
						children: endpoint.response
					})] })]
				})
			]
		})]
	});
}
var exchangeApiBaseUrl = "https://api.alta.exchange/v1";
var exchangeApiEndpoints = [
	{
		method: "GET",
		path: "/companies",
		summary: "List all issuers currently listed on Alta Exchange.",
		mockFn: "getCompanies()",
		response: "ListedCompany[]"
	},
	{
		method: "GET",
		path: "/companies/:ticker",
		summary: "Retrieve a full company profile including filings, stats, and price history.",
		mockFn: "getCompany(ticker)",
		params: "ticker — symbol (e.g. NPC, ALTB)",
		response: "CompanyProfile | null"
	},
	{
		method: "GET",
		path: "/indices",
		summary: "List all NSX benchmark indices published by Alta Exchange.",
		mockFn: "getIndices()",
		response: "ExchangeIndex[]"
	},
	{
		method: "GET",
		path: "/indices/:symbol",
		summary: "Retrieve a single index with constituents count and time series.",
		mockFn: "getIndex(symbol)",
		params: "symbol — index code (e.g. NSX-100)",
		response: "ExchangeIndex | null"
	},
	{
		method: "GET",
		path: "/ipos",
		summary: "List IPO offerings — open subscriptions, upcoming bookbuilds, and recent listings.",
		mockFn: "getIPOs(stage?)",
		params: "stage — open | upcoming | recent (optional)",
		response: "IPOListing[]"
	},
	{
		method: "GET",
		path: "/filings",
		summary: "Research library — commentary, issuer filings, prospectuses, and exchange notices.",
		mockFn: "getFilings(section?)",
		params: "section — commentary | filings | prospectuses | economic | notices (optional)",
		response: "ResearchDocument[]"
	},
	{
		method: "GET",
		path: "/corporate-actions",
		summary: "Corporate actions across listed issuers — dividends, splits, buybacks, mergers, tenders.",
		mockFn: "getCorporateActions()",
		response: "CorporateAction[]"
	},
	{
		method: "GET",
		path: "/market/stats",
		summary: "Exchange-wide statistics, live session snapshot, and market rankings.",
		mockFn: "getMarketStats()",
		response: "MarketStats"
	}
];
var exchangeApiConsumers = [
	{
		name: "Alta Terminal",
		role: "First-party brokerage interface"
	},
	{
		name: "Third-party brokerages",
		role: "Licensed market data & order routing partners"
	},
	{
		name: "Institutional clients",
		role: "Portfolio analytics and research integrations"
	}
];
function maskApiKey(key) {
	if (key.length <= 12) return key;
	return `${key.slice(0, 12)}${"•".repeat(8)}${key.slice(-4)}`;
}
function ApiDocsPanel({ session, onSignOut }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mb-10 flex flex-wrap items-center justify-between gap-4 border-gold/30 bg-gold/5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
					children: "Authenticated"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 font-medium",
					children: session.organization
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
					className: "mt-1 block font-mono text-[12px] text-muted-foreground",
					children: maskApiKey(session.key)
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onSignOut,
				className: "rounded-md border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
				children: "Sign out"
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
			className: "mb-10",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] leading-relaxed text-muted-foreground",
				children: "Documentation below is available to licensed API consumers only. All endpoints return mock data in this preview — no live market connectivity."
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-[1.4fr_1fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Architecture",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "overflow-x-auto font-mono text-[12px] leading-relaxed text-muted-foreground",
					children: `Alta Terminal / third-party brokerages
              ↓
      Alta Exchange API (HTTP)
              ↓
        Exchange data services`
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-[13px] leading-relaxed text-muted-foreground",
					children: "First-party and third-party consumers share a single API surface. Alta Terminal is a client — not the exchange itself. Licensed brokerages receive the same market data and listing endpoints under separate credentials."
				})] })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Base URL",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
						children: "Production (planned)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
						className: "mt-2 block break-all font-mono text-[14px] text-gold",
						children: exchangeApiBaseUrl
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
						children: "Your credentials"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 rounded-md border border-border/60 bg-surface-2 px-3 py-2 font-mono text-[11px] text-foreground/90",
						children: ["Authorization: Bearer ", session.key]
					})
				] })
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Authorized Consumers",
			className: "mt-12",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-3",
				children: exchangeApiConsumers.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: c.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[13px] text-muted-foreground",
					children: c.role
				})] }, c.name))
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
			title: "Endpoints",
			className: "mt-12",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-6 max-w-2xl text-[13px] leading-relaxed text-muted-foreground",
				children: "Read-only market data endpoints. Order routing and execution APIs will be documented separately under a trading namespace."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-4",
				children: exchangeApiEndpoints.map((endpoint) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApiEndpointCard, {
					endpoint,
					baseUrl: exchangeApiBaseUrl
				}, endpoint.path))
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "SDK Import (Preview)",
			className: "mt-12",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: "TypeScript — mock service layer"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "mt-3 overflow-x-auto rounded-md border border-border/60 bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-foreground/90",
				children: `import { exchangeApi } from "@/lib/exchange/api";

const companies = exchangeApi.getCompanies();
const profile = exchangeApi.getCompany("NPC");
const stats = exchangeApi.getMarketStats();`
			})] })
		})
	] });
}
function developerSession(user) {
	return {
		organization: user.discordUsername,
		key: `alta_dev_${user.id.slice(0, 8)}`
	};
}
function ExchangeApi() {
	const user = useCurrentUser();
	if (!user) return null;
	const session = developerSession(user);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Developer API",
		title: "Exchange API",
		description: "Licensed market data access for Alta Terminal, brokerages, and institutional integrations.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApiDocsPanel, {
			session,
			onSignOut: () => {}
		})]
	});
}
//#endregion
export { ExchangeApi as component };
