import { useRouteContext } from "@tanstack/react-router";
import { fallbackSiteContext } from "@/lib/site/site-context";
import type { SiteConfig } from "@/config/sites";

/** Active Alta site context (subdomain / dev override). */
export function useSiteContext(): SiteConfig {
  const context = useRouteContext({ from: "__root__", strict: false }) as { site?: SiteConfig };
  return context.site ?? fallbackSiteContext();
}
