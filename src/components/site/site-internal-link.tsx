import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { SiteKey } from "@/config/sites";
import {
  devSiteSearchParams,
  needsDevSiteSearchParam,
  usesLocalhostSiteParam,
} from "@/lib/site/local-dev-site";
import { resolveSiteKeyFromHost, readRequestHost } from "@/lib/site/site-context";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import {
  normalizeInternalSearch,
  serializeInternalSearch,
} from "@/lib/internal/normalize-internal-search";

export type SiteInternalLinkTarget =
  | { kind: "router"; to: string; search?: Record<string, unknown> }
  | { kind: "url"; href: string };

function appendSearch(href: string, search?: Record<string, unknown>): string {
  const normalized = normalizeInternalSearch(search);
  if (Object.keys(normalized).length === 0) return href;
  const url = new URL(href);
  // Clear then set in canonical order so href query order is deterministic.
  url.search = "";
  const qs = serializeInternalSearch(normalized);
  return qs ? `${url.toString().split("?")[0]}?${qs}` : url.toString();
}

function mergeSearch(
  siteKey: SiteKey,
  to: string,
  host: string,
  search?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!usesLocalhostSiteParam(host)) {
    return search ? normalizeInternalSearch(search) : search;
  }
  if (!needsDevSiteSearchParam(siteKey, to)) {
    return search ? normalizeInternalSearch(search) : search;
  }
  return normalizeInternalSearch({ ...devSiteSearchParams(siteKey), ...search });
}

/** Keep in-app navigation on the active entity site (subdomain in prod, ?site= on plain localhost). */
export function resolveSiteInternalLink(
  siteKey: SiteKey,
  to: string,
  options?: { search?: Record<string, unknown>; host?: string },
): SiteInternalLinkTarget {
  const host = options?.host ?? readRequestHost();

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

export type SiteInternalLinkProps = {
  siteKey: SiteKey;
  to: string;
  search?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-current"?: "page" | undefined;
  /** Prefer exact when the caller drives active state (sidebar / contextual nav). */
  activeOptions?: { exact?: boolean; includeSearch?: boolean };
} & Omit<ComponentPropsWithoutRef<"a">, "href">;

export const SiteInternalLink = forwardRef<HTMLAnchorElement, SiteInternalLinkProps>(
  function SiteInternalLink(
    {
      siteKey,
      to,
      search,
      className,
      children,
      onClick,
      "aria-current": ariaCurrent,
      activeOptions,
      ...props
    },
    ref,
  ) {
    const target = resolveSiteInternalLink(siteKey, to, { search });

    if (target.kind === "url") {
      return (
        <a
          ref={ref}
          href={target.href}
          className={className}
          onClick={onClick}
          aria-current={ariaCurrent}
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <Link
        ref={ref}
        to={target.to}
        search={target.search}
        className={className}
        onClick={onClick}
        aria-current={ariaCurrent}
        activeOptions={activeOptions ?? { exact: true }}
        {...props}
      >
        {children}
      </Link>
    );
  },
);
