"use client";

import { SiteInternalLink } from "@/components/site/site-internal-link";
import { BackToSiteButton } from "@/components/internal/console/back-to-site-button";
import { InternalNavLinks, useAuthorizedInternalNavGroups } from "@/components/internal/console/internal-nav";
import { useSiteContext } from "@/hooks/use-site-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { internalHomePathForSite } from "@/lib/internal/entity-internal-scope";

export function InternalSidebar() {
  const site = useSiteContext();
  const user = useCurrentUser();
  const navGroups = useAuthorizedInternalNavGroups();
  const homePath = internalHomePathForSite(site.key, user);
  const consoleLabel =
    site.key === "corporate"
      ? "Group operations console"
      : site.key === "terminal"
        ? "Operations console"
        : site.key === "exchange"
          ? "Maintenance console"
          : "Operations console";

  return (
    <aside className="internal-sidebar flex h-full w-[13.5rem] shrink-0 flex-col border-r border-border/80 bg-surface-1/40">
      <div className="border-b border-border/60 px-3 py-3">
        <SiteInternalLink siteKey={site.key} to={homePath} className="flex items-center gap-2">
          <span className="block h-3.5 w-px bg-gold" aria-hidden />
          <span className="font-serif text-[13px] tracking-tight text-foreground">{site.shortName}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold/80">Internal</span>
        </SiteInternalLink>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
          {consoleLabel}
        </p>
      </div>

      {navGroups.length > 0 ? (
        <InternalNavLinks idPrefix="sidebar" />
      ) : (
        <div className="min-h-0 flex-1 px-3 py-4">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {site.key === "exchange"
              ? `${site.displayName} operations tools arrive in a later phase. Maintenance settings remain available.`
              : site.key === "terminal"
                ? `No operational tools are available for ${site.displayName} yet.`
                : `No operational tools are available for ${site.displayName} yet.`}
          </p>
        </div>
      )}

      <div className="shrink-0 border-t border-border/60 p-2">
        <BackToSiteButton />
      </div>
    </aside>
  );
}
