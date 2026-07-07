import { useRouterState } from "@tanstack/react-router";
import { AltaWordmark } from "./alta-logo";
import { AuthUserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme";
import { Sun, Moon, Menu, ArrowUpRight } from "lucide-react";
import { memo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSiteContext } from "@/hooks/use-site-context";
import { resolveSiteNavLinks } from "@/lib/site/site-nav-links";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { useBankPrimaryNavLinks } from "@/hooks/use-bank-primary-nav";
import type { SiteConfig, SiteKey, SiteNavLink } from "@/config/sites";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isNavLinkActive(pathname: string, link: SiteNavLink): boolean {
  const path = normalizePath(pathname);

  if (link.activePaths?.length) {
    const prefixActive = link.activePaths.some((target) => {
      const normalized = normalizePath(target);
      return path === normalized || path.startsWith(`${normalized}/`);
    });
    if (prefixActive) return true;
  }

  if (link.exact) return path === normalizePath(link.to);
  const prefix = link.match ?? String(link.to);
  const normalizedPrefix = normalizePath(prefix);
  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

const NAV_HEIGHT_CLASS = "h-14 sm:h-16";

function SiteBrandLink({ site }: { site: SiteConfig }) {
  return (
    <SiteInternalLink
      siteKey={site.key}
      to="/"
      className="flex shrink-0 items-center"
      aria-label={`${site.displayName} home`}
    >
      <AltaWordmark suffix={site.wordmarkSuffix} />
    </SiteInternalLink>
  );
}

function NavLinkItem({
  siteKey,
  link,
  pathname,
  onNavigate,
  className,
}: {
  siteKey: SiteKey;
  link: SiteNavLink;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const active = isNavLinkActive(pathname, link);

  if (link.external) {
    return (
      <a
        href={String(link.to)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={cn(className, "inline-flex items-center gap-1")}
      >
        {link.label}
        <ArrowUpRight className="size-3 opacity-70" aria-hidden />
      </a>
    );
  }

  return (
    <SiteInternalLink
      siteKey={siteKey}
      to={String(link.to)}
      onClick={onNavigate}
      className={className}
      aria-current={active ? "page" : undefined}
    >
      {link.label}
    </SiteInternalLink>
  );
}

export const SiteNav = memo(function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const site = useSiteContext();

  if (site.key === "ncc") return null;
  const bankNavLinks = useBankPrimaryNavLinks();
  const navLinks = site.key === "bank" ? bankNavLinks : resolveSiteNavLinks(site.key);
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDenseNav = site.key === "bank" || site.key === "exchange" || site.key === "terminal";
  const desktopNavClass = isDenseNav ? "xl:flex" : "lg:flex";
  const mobileMenuClass = isDenseNav ? "xl:hidden" : "lg:hidden";

  const desktopLinkClass = (active: boolean) =>
    cn(
      "type-nav relative shrink-0 whitespace-nowrap rounded-md py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground",
      isDenseNav ? "px-2 text-[12px]" : "px-3",
      active &&
        "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[17px] after:h-[2px] after:rounded-full after:bg-gold",
    );

  const mobileLinkClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-3 text-base font-medium transition-colors",
      active
        ? "bg-surface-2 text-foreground"
        : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
    );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[100] border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div
          className={`mx-auto flex ${NAV_HEIGHT_CLASS} max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6`}
        >
          <SiteBrandLink site={site} />
          <nav
            className={cn(
              "hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-hidden px-1",
              desktopNavClass,
            )}
          >
            {navLinks.map((link) => {
              const active = isNavLinkActive(pathname, link);
              return (
                <NavLinkItem
                  key={`${link.label}-${String(link.to)}`}
                  siteKey={site.key}
                  link={link}
                  pathname={pathname}
                  className={desktopLinkClass(active)}
                />
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {site.ctaLabel && site.ctaRoute ? (
              <SiteInternalLink
                siteKey={site.key}
                to={site.ctaRoute}
                className="hidden rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
              >
                {site.ctaLabel}
              </SiteInternalLink>
            ) : null}
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>
            <div className="hidden md:block">
              <AuthUserMenu />
            </div>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Open menu"
                  className={cn(
                    "rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong",
                    mobileMenuClass,
                  )}
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto p-0">
                <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
                  <SheetTitle className="text-left">
                    <AltaWordmark suffix={site.wordmarkSuffix} />
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 p-4">
                  {navLinks.map((link) => {
                    const active = isNavLinkActive(pathname, link);
                    return (
                      <NavLinkItem
                        key={`${link.label}-${String(link.to)}`}
                        siteKey={site.key}
                        link={link}
                        pathname={pathname}
                        onNavigate={() => setMobileOpen(false)}
                        className={mobileLinkClass(active)}
                      />
                    );
                  })}
                  {site.ctaLabel && site.ctaRoute ? (
                    <SiteInternalLink
                      siteKey={site.key}
                      to={site.ctaRoute}
                      onClick={() => setMobileOpen(false)}
                      className="mt-2 rounded-md bg-primary px-3 py-3 text-center text-base font-medium text-primary-foreground"
                    >
                      {site.ctaLabel}
                    </SiteInternalLink>
                  ) : null}
                </nav>
                <div className="border-t border-border/60 p-4">
                  <AuthUserMenu />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <div className={NAV_HEIGHT_CLASS} aria-hidden="true" />
    </>
  );
});

export { MarketingFooter, PublicFooter, SiteFooter } from "./footers";
export { SiteFooterGate } from "./site-footer-gate";
