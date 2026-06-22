import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as cn } from "./site-nav-C-b1VkXL.mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-ZY9JEvww.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-hxQSS5wy.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, o as Textarea, r as SelectItem, t as Select } from "./select-PlOUf2bA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-ABLLAFrw2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KEYS_STORAGE = "alta-exchange-api-keys";
var SESSION_STORAGE = "alta-exchange-api-session";
function readKeys() {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(KEYS_STORAGE);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}
function writeKeys(keys) {
	localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}
function readApiSession() {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(SESSION_STORAGE);
		if (!raw) return null;
		const session = JSON.parse(raw);
		return findKeyRecord(session.key) ? session : null;
	} catch {
		return null;
	}
}
function findKeyRecord(key) {
	const trimmed = key.trim();
	return readKeys().find((k) => k.key === trimmed);
}
function saveApiSession(session) {
	localStorage.setItem(SESSION_STORAGE, JSON.stringify(session));
}
function clearApiSession() {
	localStorage.removeItem(SESSION_STORAGE);
}
function generateApiKey() {
	return `ax_live_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}
function submitApiApplication(application) {
	const record = {
		key: generateApiKey(),
		organization: application.organization.trim(),
		useCase: application.useCase,
		issuedAt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
	};
	writeKeys([...readKeys(), record]);
	return record;
}
function maskApiKey(key) {
	if (key.length <= 12) return key;
	return `${key.slice(0, 12)}${"•".repeat(8)}${key.slice(-4)}`;
}
var useCaseOptions = [
	"Brokerage integration",
	"Research & analytics",
	"Terminal integration",
	"Institutional data feed",
	"Other"
];
var fieldClass = "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";
function toSelectValue(option) {
	return option.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
var previewPrimaryButtonClass = "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70";
function ApiAccessGate({ onAuthenticated }) {
	const [tab, setTab] = (0, import_react.useState)("sign-in");
	function enterPreviewDocs() {
		const record = submitApiApplication({
			organization: "Preview Consumer",
			contactName: "Demo Access",
			useCase: "Terminal integration",
			description: "Preview documentation access."
		});
		const session = {
			key: record.key,
			organization: record.organization
		};
		saveApiSession(session);
		onAuthenticated(session);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto w-full max-w-xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "mb-6",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "Alta Exchange API documentation is restricted to licensed consumers. Sign in with your API key or submit an application for review."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-6 flex justify-center gap-1 border-b border-border/60 pb-4",
				children: [{
					id: "sign-in",
					label: "Sign in"
				}, {
					id: "apply",
					label: "Apply for access"
				}].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(t.id),
					className: cn("rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors", tab === t.id ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"),
					children: t.label
				}, t.id))
			}),
			tab === "sign-in" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "API key"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							readOnly: true,
							placeholder: "ax_live_...",
							className: cn(fieldClass, "font-mono")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "border-gold/30 bg-gold/5 !p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] leading-relaxed text-muted-foreground",
							children: "Sign-in is simulated in this preview. API keys will be issued after manual review in production."
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: true,
						className: previewPrimaryButtonClass,
						children: "Sign in (preview only)"
					})
				]
			}) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Organization"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							readOnly: true,
							placeholder: "Firm or institution name",
							className: fieldClass
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Contact name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							readOnly: true,
							placeholder: "Primary technical contact",
							className: fieldClass
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Use case"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							disabled: true,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: cn(fieldClass, "h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Select use case" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: useCaseOptions.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: toSelectValue(option),
								children: option
							}, option)) })]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Intended integration"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							readOnly: true,
							placeholder: "Describe how you plan to use Alta Exchange market data…",
							className: cn(fieldClass, "min-h-[5rem] resize-none focus-visible:ring-0")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "border-gold/30 bg-gold/5 !p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] leading-relaxed text-muted-foreground",
							children: "Applications are reviewed manually. Submission is simulated in this preview."
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: true,
						className: previewPrimaryButtonClass,
						children: "Submit application (preview only)"
					})
				]
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-8 text-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: enterPreviewDocs,
					className: "font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline",
					children: "View API documentation (preview access) →"
				})
			})
		]
	});
}
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
function ExchangeApi() {
	const [session, setSession] = (0, import_react.useState)(null);
	const [ready, setReady] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setSession(readApiSession());
		setReady(true);
	}, []);
	function handleSignOut() {
		clearApiSession();
		setSession(null);
	}
	if (!ready) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Developer API",
		title: "Exchange API",
		description: session ? "Licensed market data access for Alta Terminal, brokerages, and institutional integrations." : "Programmatic access to Alta Exchange market data. Credentials required.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), session ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApiDocsPanel, {
			session,
			onSignOut: handleSignOut
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex justify-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ApiAccessGate, { onAuthenticated: setSession })
		})]
	});
}
//#endregion
export { ExchangeApi as component };
