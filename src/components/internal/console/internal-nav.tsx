"use client";

import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  filterInternalNavGroupsForAccess,
  filterInternalNavLinksForAccess,
  getInternalNavGroupsForSite,
  getInternalPrimaryNav,
  isInternalNavActive,
  type InternalNavGroup,
  type InternalNavLink,
} from "@/components/internal/console/internal-nav-config";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { useSiteContext } from "@/hooks/use-site-context";
import { useCurrentUser } from "@/hooks/use-current-user";

export function useAuthorizedInternalNavGroups(): InternalNavGroup[] {
  const site = useSiteContext();
  const user = useCurrentUser();
  const groups = getInternalNavGroupsForSite(site.key) ?? [];
  return filterInternalNavGroupsForAccess(groups, site.key, user);
}

export function useAuthorizedPrimaryNav(): InternalNavLink[] {
  const site = useSiteContext();
  const user = useCurrentUser();
  return filterInternalNavLinksForAccess(getInternalPrimaryNav(site.key), site.key, user);
}

export function InternalNavLinks({
  onNavigate,
  idPrefix = "internal-nav",
}: {
  onNavigate?: () => void;
  idPrefix?: string;
}) {
  const site = useSiteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const links = useAuthorizedPrimaryNav();

  if (links.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Internal console" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
      <ul className="space-y-px">
        {links.map((link) => {
          const active = isInternalNavActive(pathname, link);
          return (
            <li key={`${idPrefix}-${link.to}-${link.label}`}>
              <SiteInternalLink
                siteKey={site.key}
                to={link.to}
                onClick={() => onNavigate?.()}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block rounded-sm px-2 py-1.5 pl-3 text-[13px] leading-snug transition-colors",
                  active
                    ? "bg-surface-2 font-medium text-foreground before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:bg-gold"
                    : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                )}
              >
                {link.label}
              </SiteInternalLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
