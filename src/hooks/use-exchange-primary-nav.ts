import { useMemo } from "react";
import { buildExchangePrimaryNavLinks } from "@/lib/exchange/exchange-primary-nav";
import type { SiteNavLink } from "@/config/sites";

export function useExchangePrimaryNavLinks(): SiteNavLink[] {
  return useMemo(() => buildExchangePrimaryNavLinks(), []);
}
