import {
  getDomainHosts,
  isLocalDevHostname,
  isMainHost,
  productHomePaths,
  type ProductDomain,
} from "./config";
import { getCurrentSubdomain, getHostname } from "./host";

function getProtocol(): string {
  if (typeof window !== "undefined") {
    return window.location.protocol;
  }
  return "https:";
}

function getPortSuffix(hostname: string): string {
  if (typeof window === "undefined" || !window.location.port) {
    return "";
  }

  const host = getDomainHosts(hostname);
  const configuredHosts = new Set([
    host.main,
    host.bank,
    host.terminal,
    host.exchange,
  ]);

  if (!configuredHosts.has(hostname) && !isLocalDevHostname(hostname)) {
    return "";
  }

  return `:${window.location.port}`;
}

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

type BuildUrlOptions = {
  /** Force an absolute URL even when a relative path would work. */
  absolute?: boolean;
};

function buildProductUrl(
  product: ProductDomain,
  path?: string,
  options: BuildUrlOptions = {},
): string {
  const hostname = getHostname();
  const hosts = getDomainHosts(hostname);
  const targetHost = hosts[product];
  const resolvedPath = normalizePath(path ?? productHomePaths[product]);

  const onMainHost =
    isMainHost(hostname, hosts.main) ||
    hostname === "localhost" ||
    hostname === "127.0.0.1";

  if (!options.absolute && onMainHost) {
    return resolvedPath;
  }

  if (!options.absolute && hostname === targetHost) {
    return resolvedPath;
  }

  return `${getProtocol()}//${targetHost}${getPortSuffix(hostname)}${resolvedPath}`;
}

export function getMainSiteUrl(path = productHomePaths.main, options?: BuildUrlOptions): string {
  return buildProductUrl("main", path, options);
}

export function getBankUrl(path = productHomePaths.bank, options?: BuildUrlOptions): string {
  return buildProductUrl("bank", path, options);
}

export function getTerminalUrl(
  path = productHomePaths.terminal,
  options?: BuildUrlOptions,
): string {
  return buildProductUrl("terminal", path, options);
}

export function getExchangeUrl(
  path = productHomePaths.exchange,
  options?: BuildUrlOptions,
): string {
  return buildProductUrl("exchange", path, options);
}

/** Whether the current host is serving a product-specific subdomain. */
export function useAbsoluteProductNav(hostname = getHostname()): boolean {
  return import.meta.env.PROD && !isLocalDevHostname(hostname);
}

const productUrlGetters = {
  main: getMainSiteUrl,
  bank: getBankUrl,
  terminal: getTerminalUrl,
  exchange: getExchangeUrl,
} as const;

/** Nav href: relative paths on localhost, product subdomain URLs in production. */
export function getProductNavUrl(
  product: ProductDomain,
  path?: string,
  hostname = getHostname(),
): string {
  const getter = productUrlGetters[product];
  return getter(path, { absolute: useAbsoluteProductNav(hostname) });
}

export function isOnProductSubdomain(): boolean {
  const subdomain = getCurrentSubdomain();
  return subdomain !== null && subdomain !== "main";
}
