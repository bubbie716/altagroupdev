/**
 * Domain configuration for Alta Group multi-subdomain architecture.
 *
 * Production hostnames are driven by VITE_* env vars so deployments can be
 * retargeted without code changes. Local development uses *.localhost hosts
 * when hostname ends with `.localhost` or equals `localhost`.
 */

export type ProductDomain = "main" | "bank" | "terminal" | "exchange";

const env = import.meta.env;

/** Production hostnames (no protocol, no port). */
export const productionDomains = {
  main: env.VITE_MAIN_DOMAIN ?? "altagroup.dev",
  bank: env.VITE_BANK_DOMAIN ?? "bank.altagroup.dev",
  terminal: env.VITE_TERMINAL_DOMAIN ?? "terminal.altagroup.dev",
  exchange: env.VITE_EXCHANGE_DOMAIN ?? "exchange.altagroup.dev",
} as const;

/** Local development hostnames for subdomain testing. */
export const developmentDomains = {
  main: env.VITE_DEV_MAIN_HOST ?? "localhost",
  bank: env.VITE_DEV_BANK_HOST ?? "bank.localhost",
  terminal: env.VITE_DEV_TERMINAL_HOST ?? "terminal.localhost",
  exchange: env.VITE_DEV_EXCHANGE_HOST ?? "exchange.localhost",
} as const;

/** Default in-app paths for each product experience. */
export const productHomePaths = {
  main: "/",
  bank: "/bank/dashboard",
  terminal: "/terminal",
  exchange: "/exchange",
} as const satisfies Record<ProductDomain, string>;

export function isLocalDevHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
}

/** Apex and www variants of the configured main domain. */
export function getMainHostVariants(mainDomain: string): string[] {
  const main = mainDomain.toLowerCase();
  const www = `www.${main}`;
  return main.startsWith("www.") ? [main] : [main, www];
}

export function isMainHost(hostname: string, mainDomain: string): boolean {
  return getMainHostVariants(mainDomain).includes(hostname.toLowerCase());
}

/** Resolve configured hostnames for the current environment. */
export function getDomainHosts(hostname: string) {
  return isLocalDevHostname(hostname) ? developmentDomains : productionDomains;
}
