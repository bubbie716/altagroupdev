import { o as __toESM } from "../_runtime.mjs";
import { M as redirect, c as HeadContent, d as createRouter, f as Outlet, g as Link, h as createRootRouteWithContext, m as createFileRoute, p as lazyRouteComponent, s as Scripts, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { i as fetchCurrentUser, n as ThemeProvider, t as THEME_INIT_SCRIPT } from "./auth.functions-AvLZQ5C2.mjs";
import { t as Route$55 } from "../_companyId-BudqImoe.mjs";
import { t as Route$56 } from "../_companyId-ChpqZn4h.mjs";
import { t as Route$57 } from "../_ticker-BQaoGd4-.mjs";
import { r as getBankDescription } from "./api-BMHYd9JH.mjs";
import { _ as sessionMaxAgeSec, c as unsealJson, d as getOAuthStateCookieName, f as getSessionCookieName, g as redirectWithSetCookies, h as readCookie, i as isDatabaseConfigured, l as buildClearCookie, m as oauthStateMaxAgeSec, n as loginWithDiscordProfile, o as randomToken, p as loginErrorRedirect, s as sealJson, u as buildSetCookie } from "./auth.service-C-cH6bR2.mjs";
import { t as Route$58 } from "./companies-D7zT-_eM.mjs";
import { t as Route$59 } from "./companies-DEwAYn0Y.mjs";
import { t as getMarketStats } from "./market-stats-C3ED_Sdd.mjs";
import { l as getTerminalDescription } from "./api-q9xPrXz_.mjs";
import { t as Route$60 } from "./login-rc708a2U.mjs";
import { t as Route$61 } from "./route-DVYT9897.mjs";
import { a as privateClientBeforeLoad, i as internalBeforeLoad, n as authBeforeLoad, r as developerBeforeLoad, t as Route$62 } from "./owner-DmpqlVOr.mjs";
import { t as QueryClient } from "../_libs/tanstack__query-core.mjs";
import { t as QueryClientProvider } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/router--fBU1KRu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var styles_default = "/assets/styles-B4Bzsssg.css";
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
var Route$54 = createRootRouteWithContext()({
	beforeLoad: async () => {
		return { user: await fetchCurrentUser() };
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
	const { queryClient } = Route$54.useRouteContext();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
		client: queryClient,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) })
	});
}
var $$splitComponentImporter$46 = () => import("./profile-Ba8l8MBz.mjs");
var Route$53 = createFileRoute("/profile")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Profile — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$46, "component")
});
var Route$52 = createFileRoute("/markets")({ beforeLoad: () => {
	throw redirect({ to: "/exchange" });
} });
var $$splitComponentImporter$45 = () => import("./governance-CuuMLhcF.mjs");
var Route$51 = createFileRoute("/governance")({
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
	component: lazyRouteComponent($$splitComponentImporter$45, "component")
});
var Route$50 = createFileRoute("/dashboard")({ beforeLoad: () => {
	throw redirect({ to: "/terminal" });
} });
var $$splitComponentImporter$44 = () => import("./access-restricted-CwmM_71K.mjs");
var Route$49 = createFileRoute("/access-restricted")({
	head: () => ({ meta: [{ title: "Access Restricted — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$44, "component")
});
var $$splitComponentImporter$43 = () => import("./route-C4mzSYkA.mjs");
var Route$48 = createFileRoute("/terminal")({ component: lazyRouteComponent($$splitComponentImporter$43, "component") });
var $$splitComponentImporter$42 = () => import("./route-DX9eg0P8.mjs");
var Route$47 = createFileRoute("/internal")({
	beforeLoad: internalBeforeLoad,
	component: lazyRouteComponent($$splitComponentImporter$42, "component")
});
var $$splitComponentImporter$41 = () => import("./route-ClvGzf-I.mjs");
var Route$46 = createFileRoute("/exchange")({ component: lazyRouteComponent($$splitComponentImporter$41, "component") });
var $$splitComponentImporter$40 = () => import("./route-Dbd91gYc.mjs");
var Route$45 = createFileRoute("/companies")({
	beforeLoad: authBeforeLoad,
	component: lazyRouteComponent($$splitComponentImporter$40, "component")
});
var $$splitComponentImporter$39 = () => import("./routes-Dn8jV56W.mjs");
var Route$44 = createFileRoute("/")({
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
	component: lazyRouteComponent($$splitComponentImporter$39, "component")
});
var $$splitComponentImporter$38 = () => import("./terminal-Bg7hin9r.mjs");
var Route$43 = createFileRoute("/terminal/")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Alta Terminal — Invest Like the 1%" }, {
		name: "description",
		content: getTerminalDescription()
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$38, "component")
});
var $$splitComponentImporter$37 = () => import("./internal-CprQlsrg.mjs");
var Route$42 = createFileRoute("/internal/")({
	head: () => ({ meta: [{ title: "Internal Overview — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$37, "component")
});
var $$splitComponentImporter$36 = () => import("./exchange-72jScImN.mjs");
var Route$41 = createFileRoute("/exchange/")({
	head: () => ({ meta: [{ title: "Alta Exchange — National Market Infrastructure" }, {
		name: "description",
		content: getMarketStats().description
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$36, "component")
});
var $$splitComponentImporter$35 = () => import("./bank-DxtC7vWX.mjs");
var Route$40 = createFileRoute("/bank/")({
	head: () => ({ meta: [{ title: "Alta Bank — Bank Like the 1%" }, {
		name: "description",
		content: getBankDescription()
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$35, "component")
});
var $$splitComponentImporter$34 = () => import("./watchlist-Bm-XZKUh.mjs");
var Route$39 = createFileRoute("/terminal/watchlist")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Watchlist — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$34, "component")
});
var $$splitComponentImporter$33 = () => import("./trade-BVfXA2Fy.mjs");
var Route$38 = createFileRoute("/terminal/trade")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Trade — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$33, "component")
});
var $$splitComponentImporter$32 = () => import("./research-DmZmKE5P.mjs");
var Route$37 = createFileRoute("/terminal/research")({
	head: () => ({ meta: [{ title: "Research — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$32, "component")
});
var $$splitComponentImporter$31 = () => import("./portfolio-yTerb-_R.mjs");
var Route$36 = createFileRoute("/terminal/portfolio")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Portfolio — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$31, "component")
});
var $$splitComponentImporter$30 = () => import("./news-BqnpmeKZ.mjs");
var Route$35 = createFileRoute("/terminal/news")({
	head: () => ({ meta: [{ title: "Market News — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$30, "component")
});
var $$splitComponentImporter$29 = () => import("./leaderboard-StQtKe4W.mjs");
var Route$34 = createFileRoute("/terminal/leaderboard")({
	head: () => ({ meta: [{ title: "Leaderboard — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$29, "component")
});
var $$splitComponentImporter$28 = () => import("./ipo-DeUEAW7_.mjs");
var Route$33 = createFileRoute("/terminal/ipo")({
	head: () => ({ meta: [{ title: "IPO Access — Alta Terminal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$28, "component")
});
var $$splitComponentImporter$27 = () => import("./users-SamdsRLE.mjs");
var Route$32 = createFileRoute("/internal/users")({
	head: () => ({ meta: [{ title: "Users — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$27, "component")
});
var $$splitComponentImporter$26 = () => import("./terminal-dOtbDbJv.mjs");
var Route$31 = createFileRoute("/internal/terminal")({
	head: () => ({ meta: [{ title: "Terminal Activity — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$26, "component")
});
var $$splitComponentImporter$25 = () => import("./settings-DcrzBUVM.mjs");
var Route$30 = createFileRoute("/internal/settings")({
	head: () => ({ meta: [{ title: "Settings — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
var $$splitComponentImporter$24 = () => import("./listings-BLLr1TLA.mjs");
var Route$29 = createFileRoute("/internal/listings")({
	head: () => ({ meta: [{ title: "Listings — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$24, "component")
});
var $$splitComponentImporter$23 = () => import("./ipos-B1HHu539.mjs");
var Route$28 = createFileRoute("/internal/ipos")({
	head: () => ({ meta: [{ title: "IPO Applications — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$23, "component")
});
var $$splitComponentImporter$22 = () => import("./exchange-Diut1jJF.mjs");
var Route$27 = createFileRoute("/internal/exchange")({
	head: () => ({ meta: [{ title: "Exchange Ops — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$22, "component")
});
var $$splitComponentImporter$21 = () => import("./compliance-L-rhUfHQ.mjs");
var Route$26 = createFileRoute("/internal/compliance")({
	head: () => ({ meta: [{ title: "Compliance — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
var $$splitComponentImporter$20 = () => import("./bank-CP4WCmIh.mjs");
var Route$25 = createFileRoute("/internal/bank")({
	head: () => ({ meta: [{ title: "Bank Ops — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
var $$splitComponentImporter$19 = () => import("./api-applications-BVykGZnc.mjs");
var Route$24 = createFileRoute("/internal/api-applications")({
	head: () => ({ meta: [{ title: "API Applications — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
var $$splitComponentImporter$18 = () => import("./research-B91Zel-5.mjs");
var Route$23 = createFileRoute("/exchange/research")({
	head: () => ({ meta: [{ title: "Research & Filings — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
var $$splitComponentImporter$17 = () => import("./rankings-BeNTKZuX.mjs");
var Route$22 = createFileRoute("/exchange/rankings")({
	head: () => ({ meta: [{ title: "Market Rankings — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
var $$splitComponentImporter$16 = () => import("./listings-DOAgHcCV.mjs");
var Route$21 = createFileRoute("/exchange/listings")({
	head: () => ({ meta: [{ title: "Listed Companies — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
var $$splitComponentImporter$15 = () => import("./ipo-Crpi6UPY.mjs");
var Route$20 = createFileRoute("/exchange/ipo")({
	head: () => ({ meta: [{ title: "IPO Center — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
var $$splitComponentImporter$14 = () => import("./indices-fU_S4FLa.mjs");
var Route$19 = createFileRoute("/exchange/indices")({
	head: () => ({ meta: [{ title: "Market Indices — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
var $$splitComponentImporter$13 = () => import("./apply-CkitHcXo.mjs");
var Route$18 = createFileRoute("/exchange/apply")({
	head: () => ({ meta: [{ title: "List on Alta Exchange — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
var $$splitComponentImporter$12 = () => import("./api-CDOGbXml.mjs");
var Route$17 = createFileRoute("/exchange/api")({
	beforeLoad: developerBeforeLoad,
	head: () => ({ meta: [{ title: "Exchange API — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component")
});
var $$splitComponentImporter$11 = () => import("./actions-C5aCyyUV.mjs");
var Route$16 = createFileRoute("/exchange/actions")({
	head: () => ({ meta: [{ title: "Corporate Actions — Alta Exchange" }] }),
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
var $$splitComponentImporter$10 = () => import("./create-AI_ZySyN.mjs");
var Route$15 = createFileRoute("/companies/create")({
	head: () => ({ meta: [{ title: "Create Company — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
var $$splitComponentImporter$9 = () => import("./transfers-B3mtfgVa.mjs");
var Route$14 = createFileRoute("/bank/transfers")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Alta Bank Transfers — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
var $$splitComponentImporter$8 = () => import("./private-CmAQx6Ty.mjs");
var Route$13 = createFileRoute("/bank/private")({
	beforeLoad: privateClientBeforeLoad,
	head: () => ({ meta: [{ title: "Alta Private — Alta Bank" }] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component")
});
var $$splitComponentImporter$7 = () => import("./lending-9hq7D81M.mjs");
var Route$12 = createFileRoute("/bank/lending")({
	head: () => ({ meta: [{ title: "Alta Bank Lending — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
var $$splitComponentImporter$6 = () => import("./deposits-CRBZAVvc.mjs");
var Route$11 = createFileRoute("/bank/deposits")({
	head: () => ({ meta: [{ title: "Alta Bank Deposits — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
var $$splitComponentImporter$5 = () => import("./dashboard-Dwv5SCPm.mjs");
var Route$10 = createFileRoute("/bank/dashboard")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Financial Position — Alta Bank" }] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
var $$splitComponentImporter$4 = () => import("./business-6VjOoOqK.mjs");
var Route$9 = createFileRoute("/bank/business")({
	head: () => ({ meta: [{ title: "Alta Bank Business — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
var $$splitComponentImporter$3 = () => import("./accounts-BH4F6vSd.mjs");
var Route$8 = createFileRoute("/bank/accounts")({
	beforeLoad: authBeforeLoad,
	head: () => ({ meta: [{ title: "Alta Bank Accounts — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
var $$splitComponentImporter$2 = () => import("./settings-Bya0kXdI.mjs");
var Route$7 = createFileRoute("/companies/$companyId/settings")({
	beforeLoad: ({ context, params }) => {
		const membership = context.user?.companyMemberships.find((m) => m.companyId === params.companyId);
		if (!membership || membership.role !== "owner") throw redirect({
			to: "/companies/$companyId",
			params: { companyId: params.companyId }
		});
	},
	head: () => ({ meta: [{ title: "Company Settings — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
var $$splitComponentImporter$1 = () => import("./members-DNngndL6.mjs");
var Route$6 = createFileRoute("/companies/$companyId/members")({
	head: () => ({ meta: [{ title: "Company Members — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
var Route$5 = createFileRoute("/bank/admin/private")({ beforeLoad: () => {
	throw redirect({ to: "/internal/bank" });
} });
var Route$4 = createFileRoute("/bank/admin/loans")({ beforeLoad: () => {
	throw redirect({ to: "/internal/bank" });
} });
var Route$3 = createFileRoute("/bank/admin/clients")({ beforeLoad: () => {
	throw redirect({ to: "/internal/users" });
} });
var DISCORD_API = "https://discord.com/api";
function getDiscordConfig() {
	const clientId = process.env.DISCORD_CLIENT_ID;
	const clientSecret = process.env.DISCORD_CLIENT_SECRET;
	const redirectUri = process.env.DISCORD_REDIRECT_URI;
	if (!clientId || !clientSecret || !redirectUri) return null;
	return {
		clientId,
		clientSecret,
		redirectUri
	};
}
function buildDiscordAuthorizeUrl(state, redirectUri, clientId) {
	return `${DISCORD_API}/oauth2/authorize?${new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: "identify",
		state,
		prompt: "consent"
	}).toString()}`;
}
async function exchangeDiscordCode(code) {
	const config = getDiscordConfig();
	if (!config) return null;
	const body = new URLSearchParams({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		grant_type: "authorization_code",
		code,
		redirect_uri: config.redirectUri
	});
	const res = await fetch(`${DISCORD_API}/oauth2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body
	});
	if (!res.ok) return null;
	return res.json();
}
async function fetchDiscordProfile(accessToken) {
	const res = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
	if (!res.ok) return null;
	return res.json();
}
var Route$2 = createFileRoute("/api/auth/discord")({ server: { handlers: { GET: async ({ request }) => {
	const config = getDiscordConfig();
	if (!config) return new Response("Discord OAuth is not configured.", { status: 503 });
	const returnTo = new URL(request.url).searchParams.get("redirect") ?? "/profile";
	const state = randomToken(24);
	const statePayload = await sealJson({
		state,
		returnTo
	});
	if (!statePayload) return new Response("SESSION_SECRET is not configured.", { status: 503 });
	const oauthCookie = buildSetCookie(getOAuthStateCookieName(), statePayload, oauthStateMaxAgeSec());
	const authorizeUrl = buildDiscordAuthorizeUrl(state, config.redirectUri, config.clientId);
	return new Response(null, {
		status: 302,
		headers: {
			Location: authorizeUrl,
			"Set-Cookie": oauthCookie
		}
	});
} } } });
var $$splitComponentImporter = () => import("./route-CdiWukwl.mjs");
var Route$1 = createFileRoute("/exchange/company/$ticker")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var Route = createFileRoute("/api/auth/discord/callback")({ server: { handlers: { GET: async ({ request }) => {
	if (!getDiscordConfig()) return loginErrorRedirect(request, "oauth_not_configured");
	if (!isDatabaseConfigured()) return loginErrorRedirect(request, "database_not_configured");
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	if (url.searchParams.get("error") || !code || !state) return loginErrorRedirect(request, "oauth_denied");
	const cookieHeader = request.headers.get("cookie");
	const stored = readCookie(getOAuthStateCookieName(), cookieHeader);
	if (!stored) return loginErrorRedirect(request, "invalid_state");
	const parsed = await unsealJson(stored);
	if (!parsed || parsed.state !== state) return loginErrorRedirect(request, "invalid_state");
	const tokenRes = await exchangeDiscordCode(code);
	if (!tokenRes) return loginErrorRedirect(request, "token_exchange_failed");
	const profile = await fetchDiscordProfile(tokenRes.access_token);
	if (!profile) return loginErrorRedirect(request, "profile_fetch_failed");
	const auth = await loginWithDiscordProfile(profile);
	if (!auth) return loginErrorRedirect(request, "session_failed");
	return redirectWithSetCookies(parsed.returnTo.startsWith("/") && !parsed.returnTo.startsWith("//") ? parsed.returnTo : "/profile", [buildSetCookie(getSessionCookieName(), auth.sessionToken, sessionMaxAgeSec()), buildClearCookie(getOAuthStateCookieName())]);
} } } });
var ProfileRoute = Route$53.update({
	id: "/profile",
	path: "/profile",
	getParentRoute: () => Route$54
});
var MarketsRoute = Route$52.update({
	id: "/markets",
	path: "/markets",
	getParentRoute: () => Route$54
});
var LoginRoute = Route$60.update({
	id: "/login",
	path: "/login",
	getParentRoute: () => Route$54
});
var GovernanceRoute = Route$51.update({
	id: "/governance",
	path: "/governance",
	getParentRoute: () => Route$54
});
var DashboardRoute = Route$50.update({
	id: "/dashboard",
	path: "/dashboard",
	getParentRoute: () => Route$54
});
var AccessRestrictedRoute = Route$49.update({
	id: "/access-restricted",
	path: "/access-restricted",
	getParentRoute: () => Route$54
});
var TerminalRouteRoute = Route$48.update({
	id: "/terminal",
	path: "/terminal",
	getParentRoute: () => Route$54
});
var InternalRouteRoute = Route$47.update({
	id: "/internal",
	path: "/internal",
	getParentRoute: () => Route$54
});
var ExchangeRouteRoute = Route$46.update({
	id: "/exchange",
	path: "/exchange",
	getParentRoute: () => Route$54
});
var CompaniesRouteRoute = Route$45.update({
	id: "/companies",
	path: "/companies",
	getParentRoute: () => Route$54
});
var IndexRoute = Route$44.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$54
});
var TerminalIndexRoute = Route$43.update({
	id: "/",
	path: "/",
	getParentRoute: () => TerminalRouteRoute
});
var InternalIndexRoute = Route$42.update({
	id: "/",
	path: "/",
	getParentRoute: () => InternalRouteRoute
});
var ExchangeIndexRoute = Route$41.update({
	id: "/",
	path: "/",
	getParentRoute: () => ExchangeRouteRoute
});
var CompaniesIndexRoute = Route$58.update({
	id: "/",
	path: "/",
	getParentRoute: () => CompaniesRouteRoute
});
var BankIndexRoute = Route$40.update({
	id: "/bank/",
	path: "/bank/",
	getParentRoute: () => Route$54
});
var TerminalWatchlistRoute = Route$39.update({
	id: "/watchlist",
	path: "/watchlist",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalTradeRoute = Route$38.update({
	id: "/trade",
	path: "/trade",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalResearchRoute = Route$37.update({
	id: "/research",
	path: "/research",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalPortfolioRoute = Route$36.update({
	id: "/portfolio",
	path: "/portfolio",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalNewsRoute = Route$35.update({
	id: "/news",
	path: "/news",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalLeaderboardRoute = Route$34.update({
	id: "/leaderboard",
	path: "/leaderboard",
	getParentRoute: () => TerminalRouteRoute
});
var TerminalIpoRoute = Route$33.update({
	id: "/ipo",
	path: "/ipo",
	getParentRoute: () => TerminalRouteRoute
});
var InternalUsersRoute = Route$32.update({
	id: "/users",
	path: "/users",
	getParentRoute: () => InternalRouteRoute
});
var InternalTerminalRoute = Route$31.update({
	id: "/terminal",
	path: "/terminal",
	getParentRoute: () => InternalRouteRoute
});
var InternalSettingsRoute = Route$30.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => InternalRouteRoute
});
var InternalListingsRoute = Route$29.update({
	id: "/listings",
	path: "/listings",
	getParentRoute: () => InternalRouteRoute
});
var InternalIposRoute = Route$28.update({
	id: "/ipos",
	path: "/ipos",
	getParentRoute: () => InternalRouteRoute
});
var InternalExchangeRoute = Route$27.update({
	id: "/exchange",
	path: "/exchange",
	getParentRoute: () => InternalRouteRoute
});
var InternalComplianceRoute = Route$26.update({
	id: "/compliance",
	path: "/compliance",
	getParentRoute: () => InternalRouteRoute
});
var InternalBankRoute = Route$25.update({
	id: "/bank",
	path: "/bank",
	getParentRoute: () => InternalRouteRoute
});
var InternalApiApplicationsRoute = Route$24.update({
	id: "/api-applications",
	path: "/api-applications",
	getParentRoute: () => InternalRouteRoute
});
var ExchangeResearchRoute = Route$23.update({
	id: "/research",
	path: "/research",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeRankingsRoute = Route$22.update({
	id: "/rankings",
	path: "/rankings",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeListingsRoute = Route$21.update({
	id: "/listings",
	path: "/listings",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeIpoRoute = Route$20.update({
	id: "/ipo",
	path: "/ipo",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeIndicesRoute = Route$19.update({
	id: "/indices",
	path: "/indices",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeApplyRoute = Route$18.update({
	id: "/apply",
	path: "/apply",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeApiRoute = Route$17.update({
	id: "/api",
	path: "/api",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeActionsRoute = Route$16.update({
	id: "/actions",
	path: "/actions",
	getParentRoute: () => ExchangeRouteRoute
});
var CompaniesCreateRoute = Route$15.update({
	id: "/create",
	path: "/create",
	getParentRoute: () => CompaniesRouteRoute
});
var BankTransfersRoute = Route$14.update({
	id: "/bank/transfers",
	path: "/bank/transfers",
	getParentRoute: () => Route$54
});
var BankPrivateRoute = Route$13.update({
	id: "/bank/private",
	path: "/bank/private",
	getParentRoute: () => Route$54
});
var BankLendingRoute = Route$12.update({
	id: "/bank/lending",
	path: "/bank/lending",
	getParentRoute: () => Route$54
});
var BankDepositsRoute = Route$11.update({
	id: "/bank/deposits",
	path: "/bank/deposits",
	getParentRoute: () => Route$54
});
var BankDashboardRoute = Route$10.update({
	id: "/bank/dashboard",
	path: "/bank/dashboard",
	getParentRoute: () => Route$54
});
var BankBusinessRoute = Route$9.update({
	id: "/bank/business",
	path: "/bank/business",
	getParentRoute: () => Route$54
});
var BankAccountsRoute = Route$8.update({
	id: "/bank/accounts",
	path: "/bank/accounts",
	getParentRoute: () => Route$54
});
var CompaniesCompanyIdRouteRoute = Route$61.update({
	id: "/$companyId",
	path: "/$companyId",
	getParentRoute: () => CompaniesRouteRoute
});
var InternalCompaniesIndexRoute = Route$59.update({
	id: "/companies/",
	path: "/companies/",
	getParentRoute: () => InternalRouteRoute
});
var CompaniesCompanyIdIndexRoute = Route$55.update({
	id: "/",
	path: "/",
	getParentRoute: () => CompaniesCompanyIdRouteRoute
});
var InternalCompaniesCompanyIdRoute = Route$56.update({
	id: "/companies/$companyId",
	path: "/companies/$companyId",
	getParentRoute: () => InternalRouteRoute
});
var CompaniesCompanyIdSettingsRoute = Route$7.update({
	id: "/settings",
	path: "/settings",
	getParentRoute: () => CompaniesCompanyIdRouteRoute
});
var CompaniesCompanyIdMembersRoute = Route$6.update({
	id: "/members",
	path: "/members",
	getParentRoute: () => CompaniesCompanyIdRouteRoute
});
var BankAdminPrivateRoute = Route$5.update({
	id: "/bank/admin/private",
	path: "/bank/admin/private",
	getParentRoute: () => Route$54
});
var BankAdminLoansRoute = Route$4.update({
	id: "/bank/admin/loans",
	path: "/bank/admin/loans",
	getParentRoute: () => Route$54
});
var BankAdminClientsRoute = Route$3.update({
	id: "/bank/admin/clients",
	path: "/bank/admin/clients",
	getParentRoute: () => Route$54
});
var ApiAuthDiscordRoute = Route$2.update({
	id: "/api/auth/discord",
	path: "/api/auth/discord",
	getParentRoute: () => Route$54
});
var ExchangeCompanyTickerRouteRoute = Route$1.update({
	id: "/company/$ticker",
	path: "/company/$ticker",
	getParentRoute: () => ExchangeRouteRoute
});
var ExchangeCompanyTickerIndexRoute = Route$57.update({
	id: "/",
	path: "/",
	getParentRoute: () => ExchangeCompanyTickerRouteRoute
});
var ExchangeCompanyTickerOwnerRoute = Route$62.update({
	id: "/owner",
	path: "/owner",
	getParentRoute: () => ExchangeCompanyTickerRouteRoute
});
var ApiAuthDiscordCallbackRoute = Route.update({
	id: "/callback",
	path: "/callback",
	getParentRoute: () => ApiAuthDiscordRoute
});
var CompaniesCompanyIdRouteRouteChildren = {
	CompaniesCompanyIdMembersRoute,
	CompaniesCompanyIdSettingsRoute,
	CompaniesCompanyIdIndexRoute
};
var CompaniesRouteRouteChildren = {
	CompaniesCompanyIdRouteRoute: CompaniesCompanyIdRouteRoute._addFileChildren(CompaniesCompanyIdRouteRouteChildren),
	CompaniesCreateRoute,
	CompaniesIndexRoute
};
var CompaniesRouteRouteWithChildren = CompaniesRouteRoute._addFileChildren(CompaniesRouteRouteChildren);
var ExchangeCompanyTickerRouteRouteChildren = {
	ExchangeCompanyTickerOwnerRoute,
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
var InternalRouteRouteChildren = {
	InternalApiApplicationsRoute,
	InternalBankRoute,
	InternalComplianceRoute,
	InternalExchangeRoute,
	InternalIposRoute,
	InternalListingsRoute,
	InternalSettingsRoute,
	InternalTerminalRoute,
	InternalUsersRoute,
	InternalIndexRoute,
	InternalCompaniesCompanyIdRoute,
	InternalCompaniesIndexRoute
};
var InternalRouteRouteWithChildren = InternalRouteRoute._addFileChildren(InternalRouteRouteChildren);
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
var TerminalRouteRouteWithChildren = TerminalRouteRoute._addFileChildren(TerminalRouteRouteChildren);
var ApiAuthDiscordRouteChildren = { ApiAuthDiscordCallbackRoute };
var rootRouteChildren = {
	IndexRoute,
	CompaniesRouteRoute: CompaniesRouteRouteWithChildren,
	ExchangeRouteRoute: ExchangeRouteRouteWithChildren,
	InternalRouteRoute: InternalRouteRouteWithChildren,
	TerminalRouteRoute: TerminalRouteRouteWithChildren,
	AccessRestrictedRoute,
	DashboardRoute,
	GovernanceRoute,
	LoginRoute,
	MarketsRoute,
	ProfileRoute,
	BankAccountsRoute,
	BankBusinessRoute,
	BankDashboardRoute,
	BankDepositsRoute,
	BankLendingRoute,
	BankPrivateRoute,
	BankTransfersRoute,
	BankIndexRoute,
	ApiAuthDiscordRoute: ApiAuthDiscordRoute._addFileChildren(ApiAuthDiscordRouteChildren),
	BankAdminClientsRoute,
	BankAdminLoansRoute,
	BankAdminPrivateRoute
};
var routeTree = Route$54._addFileChildren(rootRouteChildren)._addFileTypes();
var getRouter = () => {
	return createRouter({
		routeTree,
		context: {
			queryClient: new QueryClient(),
			user: null
		},
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { getRouter };
