import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import {
  getDomainHosts,
  isLocalDevHostname,
  productHomePaths,
  type ProductDomain,
} from "./config";

function parseHostname(hostHeader: string): string {
  return hostHeader.split(":")[0]?.toLowerCase() ?? "";
}

export const getHostname = createIsomorphicFn()
  .server((): string => {
    const host = getRequestHeader("host") ?? "";
    return parseHostname(host);
  })
  .client((): string => {
    return window.location.hostname.toLowerCase();
  });

export function getCurrentSubdomain(hostname = getHostname()): ProductDomain | null {
  const hosts = getDomainHosts(hostname);

  if (hostname === hosts.bank) return "bank";
  if (hostname === hosts.terminal) return "terminal";
  if (hostname === hosts.exchange) return "exchange";
  if (hostname === hosts.main || isLocalDevHostname(hostname)) return "main";

  return null;
}

export function isMainDomain(hostname = getHostname()): boolean {
  const hosts = getDomainHosts(hostname);
  return hostname === hosts.main || isLocalDevHostname(hostname);
}

export function isBankDomain(hostname = getHostname()): boolean {
  return hostname === getDomainHosts(hostname).bank;
}

export function isTerminalDomain(hostname = getHostname()): boolean {
  return hostname === getDomainHosts(hostname).terminal;
}

export function isExchangeDomain(hostname = getHostname()): boolean {
  return hostname === getDomainHosts(hostname).exchange;
}

/** Map the active subdomain to its default in-app home path. */
export function getProductHomePath(product: ProductDomain): string {
  return productHomePaths[product];
}
