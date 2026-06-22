import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as getRequestHeader } from "./request-response-B5fXtxnG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theme-c8YCLp4t.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
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
/** Apex and www variants of the configured main domain. */
function getMainHostVariants(mainDomain) {
	const main = mainDomain.toLowerCase();
	const www = `www.${main}`;
	return main.startsWith("www.") ? [main] : [main, www];
}
function isMainHost(hostname, mainDomain) {
	return getMainHostVariants(mainDomain).includes(hostname.toLowerCase());
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
function getCurrentSubdomain(hostname = getHostname()) {
	const hosts = getDomainHosts(hostname);
	if (hostname === hosts.bank) return "bank";
	if (hostname === hosts.terminal) return "terminal";
	if (hostname === hosts.exchange) return "exchange";
	if (isMainHost(hostname, hosts.main) || isLocalDevHostname(hostname)) return "main";
	return null;
}
function getProtocol() {
	if (typeof window !== "undefined") return window.location.protocol;
	return "https:";
}
function getPortSuffix(hostname) {
	if (typeof window === "undefined" || !window.location.port) return "";
	const host = getDomainHosts(hostname);
	if (!new Set([
		host.main,
		host.bank,
		host.terminal,
		host.exchange
	]).has(hostname) && !isLocalDevHostname(hostname)) return "";
	return `:${window.location.port}`;
}
function normalizePath(path) {
	if (!path || path === "/") return "/";
	return path.startsWith("/") ? path : `/${path}`;
}
function buildProductUrl(product, path, options = {}) {
	const hostname = getHostname();
	const hosts = getDomainHosts(hostname);
	const targetHost = hosts[product];
	const resolvedPath = normalizePath(path ?? productHomePaths[product]);
	const onMainHost = isMainHost(hostname, hosts.main) || hostname === "localhost" || hostname === "127.0.0.1";
	if (!options.absolute && onMainHost) return resolvedPath;
	if (!options.absolute && hostname === targetHost) return resolvedPath;
	return `${getProtocol()}//${targetHost}${getPortSuffix(hostname)}${resolvedPath}`;
}
function getMainSiteUrl(path = productHomePaths.main, options) {
	return buildProductUrl("main", path, options);
}
function getBankUrl(path = productHomePaths.bank, options) {
	return buildProductUrl("bank", path, options);
}
function getTerminalUrl(path = productHomePaths.terminal, options) {
	return buildProductUrl("terminal", path, options);
}
function getExchangeUrl(path = productHomePaths.exchange, options) {
	return buildProductUrl("exchange", path, options);
}
/** Whether the current host is serving a product-specific subdomain. */
function useAbsoluteProductNav(hostname = getHostname()) {
	return !isLocalDevHostname(hostname);
}
var productUrlGetters = {
	main: getMainSiteUrl,
	bank: getBankUrl,
	terminal: getTerminalUrl,
	exchange: getExchangeUrl
};
/** Nav href: relative paths on localhost, product subdomain URLs in production. */
function getProductNavUrl(product, path, hostname = getHostname()) {
	const getter = productUrlGetters[product];
	return getter(path, { absolute: useAbsoluteProductNav(hostname) });
}
var ThemeCtx = (0, import_react.createContext)({
	theme: "dark",
	toggle: () => {},
	set: () => {}
});
var THEME_INIT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('alta-theme');
  var m=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var t=s||(m?'dark':'light');
  var c=document.documentElement.classList;
  if(t==='dark')c.add('dark');else c.remove('dark');
}catch(e){document.documentElement.classList.add('dark');}})();
`;
function ThemeProvider({ children }) {
	const [theme, setTheme] = (0, import_react.useState)("dark");
	(0, import_react.useEffect)(() => {
		setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
	}, []);
	const set = (t) => {
		setTheme(t);
		const c = document.documentElement.classList;
		if (t === "dark") c.add("dark");
		else c.remove("dark");
		try {
			localStorage.setItem("alta-theme", t);
		} catch {}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeCtx.Provider, {
		value: {
			theme,
			toggle: () => set(theme === "dark" ? "light" : "dark"),
			set
		},
		children
	});
}
var useTheme = () => (0, import_react.useContext)(ThemeCtx);
//#endregion
export { getExchangeUrl as a, getTerminalUrl as c, getCurrentSubdomain as i, productHomePaths as l, ThemeProvider as n, getMainSiteUrl as o, getBankUrl as r, getProductNavUrl as s, THEME_INIT_SCRIPT as t, useTheme as u };
