"use client";

import { SiteInternalLink } from "@/components/site/site-internal-link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BackToSiteButton } from "@/components/internal/console/back-to-site-button";
import { InternalNavLinks, useAuthorizedInternalNavGroups } from "@/components/internal/console/internal-nav";
import { useInternalShell } from "@/components/internal/console/internal-shell-context";
import { useSiteContext } from "@/hooks/use-site-context";
import { useCurrentUser } from "@/hooks/use-current-user";
import { internalHomePathForSite } from "@/lib/internal/entity-internal-scope";

export function InternalMobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useInternalShell();
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

  function close() {
    setMobileNavOpen(false);
  }

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        className="internal-mobile-nav flex w-[min(20rem,88vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
        aria-describedby="internal-mobile-nav-desc"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
          <SheetTitle className="flex items-center gap-2 text-left">
            <SiteInternalLink siteKey={site.key} to={homePath} onClick={close} className="flex items-center gap-2">
              <span className="block h-3.5 w-px bg-gold" aria-hidden />
              <span className="font-serif text-[13px] tracking-tight text-foreground">{site.shortName}</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold/80">Internal</span>
            </SiteInternalLink>
          </SheetTitle>
          <SheetDescription id="internal-mobile-nav-desc" className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
            {consoleLabel}
          </SheetDescription>
        </SheetHeader>

        {navGroups.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <InternalNavLinks idPrefix="mobile" onNavigate={close} />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {site.key === "terminal" || site.key === "exchange"
                ? `${site.displayName} operations tools arrive in a later phase. Use Settings for maintenance.`
                : `No operational tools are available for ${site.displayName} yet.`}
            </p>
          </div>
        )}

        <div className="shrink-0 border-t border-border/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <BackToSiteButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
