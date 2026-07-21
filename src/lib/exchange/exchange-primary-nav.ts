export type ExchangePrimaryNavLink = {
  label: string;
  to: string;
  match?: string;
  exact?: boolean;
  external?: boolean;
  activePaths?: string[];
};

/**
 * Sprint 4G — Alta Exchange product nav is retired.
 * Exchange host auth/marketing pages use an empty primary nav; traffic redirects to Terminal.
 */
export const EXCHANGE_PRIMARY_NAV_LINKS: ExchangePrimaryNavLink[] = [];

export function buildExchangePrimaryNavLinks(): ExchangePrimaryNavLink[] {
  return EXCHANGE_PRIMARY_NAV_LINKS;
}
