import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { A as redirect, c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, m as createFileRoute, p as lazyRouteComponent, s as Scripts, v as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Route$36 } from "../_ticker-CQicEQKz.mjs";
import { n as ThemeProvider, t as THEME_INIT_SCRIPT } from "./theme-BzKNVI64.mjs";
import { o as getBankDescription } from "./api-f6-s6LjW.mjs";
import { t as getMarketStats } from "./market-stats-C3ED_Sdd.mjs";
import { l as getTerminalDescription } from "./api-q9xPrXz_.mjs";
import { t as Route$37 } from "./owner-CesO7VPV.mjs";
import { t as getRequestHeader } from "./request-response-B5fXtxnG.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router-LLhamF8G.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-CdxIEvCM.css";
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
var env = {
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true,
	"TSS_DEV_SERVER": "false",
	"TSS_DEV_SSR_STYLES_BASEPATH": "/",
	"TSS_DEV_SSR_STYLES_ENABLED": "true",
	"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
	"TSS_INLINE_CSS_ENABLED": "false",
	"TSS_ROUTER_BASEPATH": "",
	"TSS_SERVER_FN_BASE": "/_serverFn/",
	"VITE_BANK_DOMAIN": "bank.altagroup.dev",
	"VITE_EXCHANGE_DOMAIN": "exchange.altagroup.dev",
	"VITE_MAIN_DOMAIN": "altagroup.dev",
	"VITE_TERMINAL_DOMAIN": "terminal.altagroup.dev"
};
/** Production hostnames (no protocol, no port). */
var productionDomains = {
	main: env.VITE_MAIN_DOMAIN ?? "altagroup.dev",
	bank: env.VITE_BANK_DOMAIN ?? "bank.altagroup.dev",
	terminal: env.VITE_TERMINAL_DOMAIN ?? "terminal.altagroup.dev",
	exchange: env.VITE_EXCHANGE_DOMAIN ?? "exchange.altagroup.dev"
};
/** Local development hostnames for subdomain testing. */
var developmentDomains = {
	main: env.VITE_DEV_MAIN_HOST ?? "localhost",
	bank: env.VITE_DEV_BANK_HOST ?? "bank.localhost",
	terminal: env.VITE_DEV_TERMINAL_HOST ?? "terminal.localhost",
	exchange: env.VITE_DEV_EXCHANGE_HOST ?? "exchange.localhost"
};
/** Default in-app paths for each product experience. */
var productHomePaths = {
	main: "/",
	bank: "/bank/dashboard",
	terminal: "/terminal",
	exchange: "/exchange"
};
function isLocalDevHostname(hostname) {
	const host = hostname.toLowerCase();
	return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}
/** Resolve configured hostnames for the current environment. */
function getDomainHosts(hostname) {
	return isLocalDevHostname(hostname) ? developmentDomains : productionDomains;
}
function parseHostname(hostHeader) {
	return hostHeader.split(":")[0]?.toLowerCase() ?? "";
}
var getHostname = () => {
	return parseHostname(getRequestHeader("host") ?? "");
};
function isBankDomain(hostname = getHostname()) {
	return hostname === getDomainHosts(hostname).bank;
}
function isTerminalDomain(hostname = getHostname()) {
	return hostname === getDomainHosts(hostname).terminal;
}
function isExchangeDomain(hostname = getHostname()) {
	return hostname === getDomainHosts(hostname).exchange;
}
/**
* When a product subdomain serves `/`, redirect to that product's in-app home.
* All other paths pass through unchanged so route-based access keeps working.
*/
function getSubdomainRootRedirect(pathname) {
	if (pathname !== "/") return null;
	if (isBankDomain()) return productHomePaths.bank;
	if (isTerminalDomain()) return productHomePaths.terminal;
	if (isExchangeDomain()) return productHomePaths.exchange;
	return null;
}
function NotFoundComponent() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$35 = createRootRouteWithContext()({
	beforeLoad: ({ location }) => {
		const target = getSubdomainRootRedirect(location.pathname);
		if (target) throw redirect({ to: target });
	},
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "Alta Group — Financial Infrastructure" },
			{
				name: "description",
				content: "Alta Group: Live Like the 1%. Alta Bank, Alta Terminal, Alta Exchange, and Newport Clearing Corporation."
			},
			{
				name: "author",
				content: "Alta Group"
			},
			{
				property: "og:title",
				content: "Alta Group"
			},
			{
				property: "og:description",
				content: "Banking. Markets. Capital. Built for Newport."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary"
			}
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("head", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", { dangerouslySetInnerHTML: { __html: THEME_INIT_SCRIPT } }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$35.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) })
	});
}
var Route$34 = createFileRoute("/markets")({ beforeLoad: () => {
	throw redirect({ to: "/exchange" });
} });
var $$splitComponentImporter$32 = () => import("./governance-B41q3mky.mjs");
var Route$33 = createFileRoute("/governance")({
	head: () => ({ meta: [
		{ title: "Governance & Structure — Alta Group" },
		{
			name: "description",
			content: "Corporate structure of Alta Group N.V. — parent holding company of Alta Bank, Alta Terminal, Alta Exchange, and Newport Clearing Corporation (planned)."
		},
		{
			property: "og:title",
			content: "Alta Group — Governance & Structure"
		},
		{
			property: "og:description",
			content: "The financial holding company behind Newport's banking, terminal, exchange, and clearing infrastructure."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$32, "component")
});
var Route$32 = createFileRoute("/dashboard")({ beforeLoad: () => {
	throw redirect({ to: "/terminal" });
} });
var $$splitComponentImporter$31 = () => import("./route-C4mzSYkA.mjs");
var Route$31 = createFileRoute("/terminal")({ component: lazyRouteComponent($$splitComponentImporter$31, "component") });
var $$splitComponentImporter$30 = () => import("./route-ClvGzf-I.mjs");
var Route$30 = createFileRoute("/exchange")({ component: lazyRouteComponent($$splitComponentImporter$30, "component") });
var $$splitComponentImporter$29 = () => import("./routes-C7etZAHm.mjs");
var Route$29 = createFileRoute("/")({
	head: () => ({ meta: [
		{ title: "Alta Group — Live Like the 1%" },
		{
			name: "description",
			content: "The financial infrastructure company of Newport. Alta Bank, Alta Terminal, Alta Exchange, and Newport Clearing Corporation."
		},
		{
			property: "og:title",
			content: "Alta Group — Live Like the 1%"
		},
		{
			property: "og:description",
			content: "The financial infrastructure company of Newport."
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$29, "component")
});
var $$splitComponentImporter$28 = () => import("./terminal-BgOo5Vaw.mjs");
var Route$28 = createFileRoute("/terminal/")({
	head: () => ({ meta: [{ title: "Alta Terminal — Invest Like the 1%" }, {
		name: "description",
		content: getTerminalDescription()
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$28, "component")
});
var $$splitComponentImporter$27 = () => import("./exchange-BsXAoEkv.mjs");
var Route$27 = createFileRoute("/exchange/")({
	head: () => ({ meta: [{ title: "Alta Exchange — National Market Infrastructure" }, {
		name: "description",
		content: getMarketStats().description
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$27, "component")
});
var $$splitComponentImporter$26 = () => import("./bank-Bs774OYF.mjs");
var Route$26 = createFileRoute("/bank/")({
	head: () => ({ meta: [{ title: "Alta Bank — Bank Like the 1%" }, {
		name: "description",
		content: getBankDescription()
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$26, "component")
});
var $$splitComponentImporter$25 = () => import("./watchlist-CKD3X8-x.mjs");
var Route$25 = createFileRoute("/terminal/watchlist")({
	head: () => ({ meta: [{ title: "Watchlist — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
var $$splitComponentImporter$24 = () => import("./trade-ByKhgt4w.mjs");
var Route$24 = createFileRoute("/terminal/trade")({
	head: () => ({ meta: [{ title: "Trade — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$24, "component")
});
var $$splitComponentImporter$23 = () => import("./research-vHrriQaz.mjs");
var Route$23 = createFileRoute("/terminal/research")({
	head: () => ({ meta: [{ title: "Research — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$23, "component")
});
var $$splitComponentImporter$22 = () => import("./portfolio-Qwsd2OYL.mjs");
var Route$22 = createFileRoute("/terminal/portfolio")({
	head: () => ({ meta: [{ title: "Portfolio — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$22, "component")
});
var $$splitComponentImporter$21 = () => import("./news-CcyovDy7.mjs");
var Route$21 = createFileRoute("/terminal/news")({
	head: () => ({ meta: [{ title: "Market News — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
var $$splitComponentImporter$20 = () => import("./leaderboard-kG4_Mlms.mjs");
var Route$20 = createFileRoute("/terminal/leaderboard")({
	head: () => ({ meta: [{ title: "Leaderboard — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
var $$splitComponentImporter$19 = () => import("./ipo-DMb5KHee.mjs");
var Route$19 = createFileRoute("/terminal/ipo")({
	head: () => ({ meta: [{ title: "IPO Access — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
var $$splitComponentImporter$18 = () => import("./research-D-GO3vsl.mjs");
var Route$18 = createFileRoute("/exchange/research")({
	head: () => ({ meta: [{ title: "Research & Filings — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
var $$splitComponentImporter$17 = () => import("./rankings-C5smzOP5.mjs");
var Route$17 = createFileRoute("/exchange/rankings")({
	head: () => ({ meta: [{ title: "Market Rankings — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./listings-CbdNShSA.mjs");
var Route$16 = createFileRoute("/exchange/listings")({
	head: () => ({ meta: [{ title: "Listed Companies — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./ipo-B7a-K8lu.mjs");
var Route$15 = createFileRoute("/exchange/ipo")({
	head: () => ({ meta: [{ title: "IPO Center — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./indices-ClStp2v1.mjs");
var Route$14 = createFileRoute("/exchange/indices")({
	head: () => ({ meta: [{ title: "Market Indices — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./apply-vGQu3JTb.mjs");
var Route$13 = createFileRoute("/exchange/apply")({
	head: () => ({ meta: [{ title: "List on Alta Exchange — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./api-ABLLAFrw2.mjs");
var Route$12 = createFileRoute("/exchange/api")({
	head: () => ({ meta: [{ title: "Exchange API — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var $$splitComponentImporter$11 = () => import("./actions-CLYJiE00.mjs");
var Route$11 = createFileRoute("/exchange/actions")({
	head: () => ({ meta: [{ title: "Corporate Actions — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("./transfers-BdqGrR8A.mjs");
var Route$10 = createFileRoute("/bank/transfers")({
	head: () => ({ meta: [{ title: "Alta Bank Transfers — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./private-DE04V63W.mjs");
var Route$9 = createFileRoute("/bank/private")({
	head: () => ({ meta: [{ title: "Alta Private — Alta Bank" }] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./lending-BcmttX3Y.mjs");
var Route$8 = createFileRoute("/bank/lending")({
	head: () => ({ meta: [{ title: "Alta Bank Lending — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./deposits-DM52f3n7.mjs");
var Route$7 = createFileRoute("/bank/deposits")({
	head: () => ({ meta: [{ title: "Alta Bank Deposits — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./dashboard-BajphIxl.mjs");
var Route$6 = createFileRoute("/bank/dashboard")({
	head: () => ({ meta: [{ title: "Financial Position — Alta Bank" }] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./business-DZwNAgoW.mjs");
var Route$5 = createFileRoute("/bank/business")({
	head: () => ({ meta: [{ title: "Alta Bank Business — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./accounts-BWJAd3gu.mjs");
var Route$4 = createFileRoute("/bank/accounts")({
	head: () => ({ meta: [{ title: "Alta Bank Accounts — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./private-CMktXHs7.mjs");
var Route$3 = createFileRoute("/bank/admin/private")({
	head: () => ({ meta: [{ title: "Alta Bank Admin — Private Invites" }] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./loans-Dg8zf5VS.mjs");
var Route$2 = createFileRoute("/bank/admin/loans")({
	head: () => ({ meta: [{ title: "Alta Bank Admin — Loan Review" }] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./clients-VUYZ1HoD.mjs");
var Route$1 = createFileRoute("/bank/admin/clients")({
	head: () => ({ meta: [{ title: "Alta Bank Admin — Clients" }] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var $$splitComponentImporter = () => import("./route-CdiWukwl.mjs");
var Route = createFileRoute("/exchange/company/$ticker")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var MarketsRoute = Route$34.update({
	id: "/markets",
	path: "/markets",
	getParentRoute: () => Route$35
});
var GovernanceRoute = Route$33.update({
	id: "/governance",
	path: "/governance",
	getParentRoute: () => Route$35
});
var DashboardRoute = Route$32.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => Route$35
});
var TerminalRouteRoute = Route$31.update({
	id: "/terminal",
	path: "/terminal",
	getParentRoute: () => Route$35
});
var ExchangeRouteRoute = Route$30.update({
	id: "/exchange",
	path: "/exchange",
	getParentRoute: () => Route$35
});
var IndexRoute = Route$29.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$35
});
var TerminalIndexRoute = Route$28.update({
	id: "/",
	path: "/",
	getParentRoute: () => TerminalRouteRoute
});
var ExchangeIndexRoute = Route$27.update({
	id: "/",
	path: "/",
	getParentRoute: () => ExchangeRouteRoute
});
var BankIndexRoute = Route$26.update({
	id: "/bank/",
	path: "/bank/",
	getParentRoute: () => Route$35
});
var TerminalWatchlistRoute = Route$25.update({
	id: "/watchlist",
	path: "/watchlist",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalTradeRoute = Route$24.update({
	id: "/trade",
	path: "/trade",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalResearchRoute = Route$23.update({
	id: "/research",
	path: "/research",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalPortfolioRoute = Route$22.update({
	id: "/portfolio",
	path: "/portfolio",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalNewsRoute = Route$21.update({
	id: "/news",
	path: "/news",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalLeaderboardRoute = Route$20.update({
	id: "/leaderboard",
	path: "/leaderboard",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalIpoRoute = Route$19.update({
	id: "/ipo",
	path: "/ipo",
	getParentRoute: () => TerminalRouteRoute
});
var ExchangeResearchRoute = Route$18.update({
	id: "/research",
	path: "/research",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeRankingsRoute = Route$17.update({
	id: "/rankings",
	path: "/rankings",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeListingsRoute = Route$16.update({
	id: "/listings",
	path: "/listings",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeIpoRoute = Route$15.update({
	id: "/ipo",
	path: "/ipo",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeIndicesRoute = Route$14.update({
	id: "/indices",
	path: "/indices",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeApplyRoute = Route$13.update({
	id: "/apply",
	path: "/apply",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeApiRoute = Route$12.update({
	id: "/api",
	path: "/api",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeActionsRoute = Route$11.update({
	id: "/actions",
	path: "/actions",
	getParentRoute: () => ExchangeRouteRoute
});
var BankTransfersRoute = Route$10.update({
	id: "/bank/transfers",
	path: "/bank/transfers",
	getParentRoute: () => Route$35
});
var BankPrivateRoute = Route$9.update({
	id: "/bank/private",
	path: "/bank/private",
	getParentRoute: () => Route$35
});
var BankLendingRoute = Route$8.update({
	id: "/bank/lending",
	path: "/bank/lending",
	getParentRoute: () => Route$35
});
var BankDepositsRoute = Route$7.update({
	id: "/bank/deposits",
	path: "/bank/deposits",
	getParentRoute: () => Route$35
});
var BankDashboardRoute = Route$6.update({
	id: "/bank/dashboard",
	path: "/bank/dashboard",
	getParentRoute: () => Route$35
});
var BankBusinessRoute = Route$5.update({
	id: "/bank/business",
	path: "/bank/business",
	getParentRoute: () => Route$35
});
var BankAccountsRoute = Route$4.update({
	id: "/bank/accounts",
	path: "/bank/accounts",
	getParentRoute: () => Route$35
});
var BankAdminPrivateRoute = Route$3.update({
	id: "/bank/admin/private",
	path: "/bank/admin/private",
	getParentRoute: () => Route$35
});
var BankAdminLoansRoute = Route$2.update({
	id: "/bank/admin/loans",
	path: "/bank/admin/loans",
	getParentRoute: () => Route$35
});
var BankAdminClientsRoute = Route$1.update({
	id: "/bank/admin/clients",
	path: "/bank/admin/clients",
	getParentRoute: () => Route$35
});
var ExchangeCompanyTickerRouteRoute = Route.update({
	id: "/company/$ticker",
	path: "/company/$ticker",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeCompanyTickerIndexRoute = Route$36.update({
	id: "/",
	path: "/",
	getParentRoute: () => ExchangeCompanyTickerRouteRoute
});
var ExchangeCompanyTickerRouteRouteChildren = {
	ExchangeCompanyTickerOwnerRoute: Route$37.update({
		id: "/owner",
		path: "/owner",
		getParentRoute: () => ExchangeCompanyTickerRouteRoute
	}),
	ExchangeCompanyTickerIndexRoute
};
var ExchangeRouteRouteChildren = {
	ExchangeActionsRoute,
	ExchangeApiRoute,
	ExchangeApplyRoute,
	ExchangeIndicesRoute,
	ExchangeIpoRoute,
	ExchangeListingsRoute,
	ExchangeRankingsRoute,
	ExchangeResearchRoute,
	ExchangeIndexRoute,
	ExchangeCompanyTickerRouteRoute: ExchangeCompanyTickerRouteRoute._addFileChildren(ExchangeCompanyTickerRouteRouteChildren)
};
var ExchangeRouteRouteWithChildren = ExchangeRouteRoute._addFileChildren(ExchangeRouteRouteChildren);
var TerminalRouteRouteChildren = {
	TerminalIpoRoute,
	TerminalLeaderboardRoute,
	TerminalNewsRoute,
	TerminalPortfolioRoute,
	TerminalResearchRoute,
	TerminalTradeRoute,
	TerminalWatchlistRoute,
	TerminalIndexRoute
};
var rootRouteChildren = {
	IndexRoute,
	ExchangeRouteRoute: ExchangeRouteRouteWithChildren,
	TerminalRouteRoute: TerminalRouteRoute._addFileChildren(TerminalRouteRouteChildren),
	DashboardRoute,
	GovernanceRoute,
	MarketsRoute,
	BankAccountsRoute,
	BankBusinessRoute,
	BankDashboardRoute,
	BankDepositsRoute,
	BankLendingRoute,
	BankPrivateRoute,
	BankTransfersRoute,
	BankIndexRoute,
	BankAdminClientsRoute,
	BankAdminLoansRoute,
	BankAdminPrivateRoute
};
var routeTree = Route$35._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: { queryClient: new QueryClient() },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
