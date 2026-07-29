"use client";

import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  filterInternalNavLinksForAccess,
  getInternalContextualNav,
  isInternalNavActive,
  type InternalNavLink,
} from "@/components/internal/console/internal-nav-config";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { useSiteContext } from "@/hooks/use-site-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { selectThenNavigate } from "@/lib/ui/close-then-run";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";

const MOBILE_VISIBLE_LINK_LIMIT = 3;

/**
 * Secondary section navigation — only appears while working inside a primary section
 * (Directory/Customers, Money, Products, System).
 */
export function InternalContextualNav({ className }: { className?: string }) {
  const site = useSiteContext();
  const user = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const contextual = getInternalContextualNav(site.key, pathname);

  if (!contextual) return null;

  const links = filterInternalNavLinksForAccess(contextual.links, site.key, user);
  const overflowLinks = contextual.overflow
    ? filterInternalNavLinksForAccess(contextual.overflow.links, site.key, user)
    : [];
  if (links.length === 0 && overflowLinks.length === 0) return null;

  const overflowActive = overflowLinks.some((link) => isInternalNavActive(pathname, link));
  const mobileLinks = [...links, ...overflowLinks];
  const mobileSplit = splitMobileNavLinks(mobileLinks, pathname);

  return (
    <nav
      aria-label={`${contextual.label} section`}
      className={cn(
        "internal-contextual-nav order-2 flex min-w-0 items-center gap-1 border-b border-border/60 bg-surface-1/30 px-3 py-1.5 sm:px-4",
        className,
      )}
    >
      <span className="mr-1 shrink-0 text-[11px] font-medium text-muted-foreground">{contextual.label}</span>

      {/* Desktop: primary links + section-specific overflow */}
      <ul className="hidden min-w-0 items-center gap-0.5 sm:flex">
        {links.map((link) => (
          <ContextualLink key={`ctx-${link.to}-${link.label}`} link={link} pathname={pathname} siteKey={site.key} />
        ))}
        {overflowLinks.length > 0 && contextual.overflow ? (
          <li>
            <ContextualNavOverflow
              label={contextual.overflow.label}
              links={overflowLinks}
              pathname={pathname}
              siteKey={site.key}
              active={overflowActive}
            />
          </li>
        ) : null}
      </ul>

      {/* Mobile: up to 3 links + More for the rest (active link always visible) */}
      <ul className="flex min-w-0 items-center gap-0.5 sm:hidden">
        {mobileSplit.visible.map((link) => (
          <ContextualLink
            key={`ctx-mobile-${link.to}-${link.label}`}
            link={link}
            pathname={pathname}
            siteKey={site.key}
          />
        ))}
        {mobileSplit.overflow.length > 0 ? (
          <li>
            <ContextualNavOverflow
              label="More"
              links={mobileSplit.overflow}
              pathname={pathname}
              siteKey={site.key}
              active={mobileSplit.overflow.some((link) => isInternalNavActive(pathname, link))}
            />
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function splitMobileNavLinks(
  links: InternalNavLink[],
  pathname: string,
  maxVisible = MOBILE_VISIBLE_LINK_LIMIT,
): { visible: InternalNavLink[]; overflow: InternalNavLink[] } {
  if (links.length <= maxVisible) {
    return { visible: links, overflow: [] };
  }

  const visible = links.slice(0, maxVisible);
  let overflow = links.slice(maxVisible);
  const activeOverflowIndex = overflow.findIndex((link) => isInternalNavActive(pathname, link));

  if (activeOverflowIndex >= 0) {
    const activeLink = overflow[activeOverflowIndex]!;
    const displaced = visible[maxVisible - 1]!;
    visible[maxVisible - 1] = activeLink;
    overflow = [displaced, ...overflow.filter((link) => link !== activeLink)];
  }

  return { visible, overflow };
}

function ContextualLink({
  link,
  pathname,
  siteKey,
}: {
  link: InternalNavLink;
  pathname: string;
  siteKey: Parameters<typeof SiteInternalLink>[0]["siteKey"];
}) {
  const active = isInternalNavActive(pathname, link);
  return (
    <li>
      <SiteInternalLink
        siteKey={siteKey}
        to={link.to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex shrink-0 rounded px-2 py-1 text-[12px] transition-colors",
          active
            ? "bg-surface-2 font-medium text-foreground"
            : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground",
        )}
      >
        {link.label}
      </SiteInternalLink>
    </li>
  );
}

function ContextualNavOverflow({
  label,
  links,
  pathname,
  siteKey,
  active,
}: {
  label: string;
  links: InternalNavLink[];
  pathname: string;
  siteKey: Parameters<typeof SiteInternalLink>[0]["siteKey"];
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[12px] transition-colors outline-none",
          active || open
            ? "bg-surface-2 font-medium text-foreground"
            : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground",
        )}
      >
        {label}
        <span aria-hidden className="text-[9px] opacity-70">
          ▾
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[11rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {links.map((link) => {
          const itemActive = isInternalNavActive(pathname, link);
          return (
            <DropdownMenuItem
              key={`ops-${link.to}`}
              onSelect={(event) => {
                selectThenNavigate(event, () => setOpen(false), () => {
                  void navigate({
                    to: link.to,
                    search: withInternalSiteSearch({}, siteKey),
                  });
                });
              }}
              className={cn("cursor-pointer", itemActive ? "font-medium text-foreground" : undefined)}
            >
              {link.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
