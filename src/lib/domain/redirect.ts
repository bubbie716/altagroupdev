import { productHomePaths, type ProductDomain } from "./config";
import { getCurrentSubdomain } from "./host";
import { getBankUrl, getExchangeUrl, getMainSiteUrl, getTerminalUrl } from "./urls";

export type SubdomainRedirect =
  | { type: "internal"; to: string }
  | { type: "external"; href: string };

function getProductForPath(pathname: string): ProductDomain {
  if (pathname.startsWith("/bank")) return "bank";
  if (pathname.startsWith("/terminal")) return "terminal";
  if (pathname.startsWith("/exchange")) return "exchange";
  return "main";
}

const productUrlGetters = {
  bank: getBankUrl,
  terminal: getTerminalUrl,
  exchange: getExchangeUrl,
} as const;

/**
 * Resolve subdomain-aware redirects.
 *
 * On product subdomains (bank.*, terminal.*, exchange.*):
 * - `/` → product home (internal)
 * - paths outside that product → correct subdomain (external)
 *
 * On the main domain, all routes remain accessible.
 */
export function resolveSubdomainRedirect(pathname: string): SubdomainRedirect | null {
  const current = getCurrentSubdomain();

  if (!current || current === "main") {
    return null;
  }

  if (pathname === "/") {
    return { type: "internal", to: productHomePaths[current] };
  }

  const pathProduct = getProductForPath(pathname);

  if (pathProduct === current) {
    return null;
  }

  if (pathProduct === "main") {
    return {
      type: "external",
      href: getMainSiteUrl(pathname, { absolute: true }),
    };
  }

  return {
    type: "external",
    href: productUrlGetters[pathProduct](pathname, { absolute: true }),
  };
}

/** @deprecated Use resolveSubdomainRedirect */
export function getSubdomainRootRedirect(pathname: string): string | null {
  const result = resolveSubdomainRedirect(pathname);
  return result?.type === "internal" ? result.to : null;
}
