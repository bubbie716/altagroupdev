import { productHomePaths } from "./config";
import { isBankDomain, isExchangeDomain, isTerminalDomain } from "./host";

/**
 * When a product subdomain serves `/`, redirect to that product's in-app home.
 * All other paths pass through unchanged so route-based access keeps working.
 */
export function getSubdomainRootRedirect(pathname: string): string | null {
  if (pathname !== "/") {
    return null;
  }

  if (isBankDomain()) {
    return productHomePaths.bank;
  }

  if (isTerminalDomain()) {
    return productHomePaths.terminal;
  }

  if (isExchangeDomain()) {
    return productHomePaths.exchange;
  }

  return null;
}
