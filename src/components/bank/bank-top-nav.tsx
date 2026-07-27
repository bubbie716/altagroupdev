"use client";

import { useRouterState } from "@tanstack/react-router";
import { ArrowLeftRight, Moon, Sun } from "lucide-react";
import { BankAccountMenu } from "@/components/bank/bank-account-menu";
import { MoveMoneyChooser } from "@/components/bank/move-money-chooser";
import { EcosystemSwitcher } from "@/components/site/ecosystem-switcher";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { useTheme } from "@/components/theme";
import { useBankPrimaryNavLinks } from "@/hooks/use-bank-primary-nav";
import { useSiteContext } from "@/hooks/use-site-context";
import { cn } from "@/lib/utils";
import type { SiteNavLink } from "@/config/sites";

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

export function BankTopNav() {
  const site = useSiteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const primaryLinks = useBankPrimaryNavLinks();

  return (
    <header
      className="sticky z-40 border-b border-border/70 bg-background/95 backdrop-blur-md"
      style={{ top: "var(--ui-lab-banner-height, 0px)" }}
    >
      <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <EcosystemSwitcher siteKey={site.key} variant="branded" className="shrink-0" />

        <nav
          className="ml-1 hidden min-w-0 flex-1 items-center gap-0.5 md:flex"
          aria-label="Bank primary"
        >
          {primaryLinks.map((link) => {
            const active = isNavLinkActive(pathname, link);
            return (
              <SiteInternalLink
                key={link.label}
                siteKey={site.key}
                to={String(link.to)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-[var(--menu-item-hover)] hover:text-foreground",
                )}
              >
                {link.label}
              </SiteInternalLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {pathname !== "/bank" && pathname !== "/bank/" ? (
            <MoveMoneyChooser>
              <ArrowLeftRight className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Move money</span>
              <span className="sm:hidden">Move</span>
            </MoveMoneyChooser>
          ) : null}

          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="inline-flex size-11 items-center justify-center rounded-md border border-border bg-surface-2/60 text-muted-foreground transition-colors hover:border-border-strong hover:bg-[var(--menu-item-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>

          <BankAccountMenu />
        </div>
      </div>
    </header>
  );
}
