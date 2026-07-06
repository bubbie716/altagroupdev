import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { SiteKey } from "@/config/sites";
import {
  devSiteSearchParams,
  needsDevSiteSearchParam,
  usesLocalhostSiteParam,
} from "@/lib/site/local-dev-site";
import { resolveSiteKeyFromHost } from "@/lib/site/site-context";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";

export type SiteInternalLinkTarget =
  | { kind: "router"; to: string; search?: Record<string, unknown> }
  | { kind: "url"; href: string };

function appendSearch(href: string, search?: Record<string, unknown>): string {
  if (!search || Object.keys(search).length === 0) return href;
  const url = new URL(href);
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function mergeSearch(
  siteKey: SiteKey,
  to: string,
  host: string,
  search?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!usesLocalhostSiteParam(host)) return search;
  if (!needsDevSiteSearchParam(siteKey, to)) return search;
  return { ...devSiteSearchParams(siteKey), ...search };
}

/** Keep in-app navigation on the active entity site (subdomain in prod, ?site= on plain localhost). */
export function resolveSiteInternalLink(
  siteKey: SiteKey,
  to: string,
  options?: { search?: Record<string, unknown>; host?: string },
): SiteInternalLinkTarget {
  const host =
    options?.host ??
    (typeof window !== "undefined" ? window.location.host : "localhost");

  if (siteKey === "corporate" || resolveSiteKeyFromHost(host) === siteKey) {
    return {
      kind: "router",
      to,
      search: mergeSearch(siteKey, to, host, options?.search),
    };
  }

  if (usesLocalhostSiteParam(host)) {
    return {
      kind: "router",
      to,
      search: mergeSearch(siteKey, to, host, options?.search),
    };
  }

  return {
    kind: "url",
    href: appendSearch(resolveEntitySiteUrl(siteKey, to, host), options?.search),
  };
}

export function SiteInternalLink({
  siteKey,
  to,
  search,
  className,
  children,
  onClick,
  "aria-current": ariaCurrent,
}: {
  siteKey: SiteKey;
  to: string;
  search?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-current"?: "page" | undefined;
}) {
  const target = resolveSiteInternalLink(siteKey, to, { search });

  if (target.kind === "url") {
    return (
      <a href={target.href} className={className} onClick={onClick} aria-current={ariaCurrent}>
        {children}
      </a>
    );
  }

  return (
    <Link
      to={target.to}
      search={target.search}
      className={className}
      onClick={onClick}
      aria-current={ariaCurrent}
    >
      {children}
    </Link>
  );
}
