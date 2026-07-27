"use client";

import { useMemo } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { useControlledMenu } from "@/hooks/use-controlled-menu";
import { useSiteContext } from "@/hooks/use-site-context";
import {
  BANK_MOBILE_NAV_ITEMS,
  buildBankMobileMoreItems,
} from "@/lib/bank/bank-primary-nav";
import { cn } from "@/lib/utils";
import type { SiteNavLink } from "@/config/sites";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Home,
  List,
  MoreHorizontal,
  WalletCards,
} from "lucide-react";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isActive(pathname: string, link: Pick<SiteNavLink, "to" | "exact" | "match" | "activePaths">): boolean {
  const path = normalizePath(pathname);
  if (link.activePaths?.length) {
    if (
      link.activePaths.some((target) => {
        const normalized = normalizePath(target);
        return path === normalized || path.startsWith(`${normalized}/`);
      })
    ) {
      return true;
    }
  }
  if (link.exact) return path === normalizePath(link.to);
  const prefix = normalizePath(link.match ?? String(link.to));
  return path === prefix || path.startsWith(`${prefix}/`);
}

const ICONS = {
  Home,
  Accounts: WalletCards,
  Activity: List,
  More: MoreHorizontal,
} as const;

export function BankMobileBottomNav() {
  const site = useSiteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const moreMenu = useControlledMenu();

  const moreItems = useMemo(() => buildBankMobileMoreItems(), []);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md md:hidden"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        // Keep CSS var in sync with the measured content row (h-16).
        ["--bank-mobile-nav-height" as string]: "4rem",
      }}
      aria-label="Bank mobile"
      data-bank-mobile-nav=""
    >
      <div className="mx-auto grid h-16 max-w-[1120px] grid-cols-4">
        {BANK_MOBILE_NAV_ITEMS.map((item) => {
          if (item.kind === "more") {
            return (
              <DropdownMenu
                key="more"
                modal={false}
                open={moreMenu.open}
                onOpenChange={moreMenu.setOpen}
              >
                <DropdownMenuTrigger
                  className={cn(
                    "inline-flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium outline-none",
                    "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
                    moreMenu.open ? "text-foreground" : "text-muted-foreground",
                  )}
                  aria-label="More"
                >
                  <MoreHorizontal className="size-5" aria-hidden />
                  More
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  className="mb-2 w-56 bg-[var(--menu-surface)]"
                  onCloseAutoFocus={(event) => {
                    if (moreMenu.isNavigating()) event.preventDefault();
                  }}
                >
                  <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    More
                  </DropdownMenuLabel>
                  {moreItems.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <DropdownMenuItem
                        key={entry.to}
                        className="cursor-pointer"
                        onSelect={() => {
                          moreMenu.runAfterClose(() => {
                            void router.navigate({ to: entry.to });
                          });
                        }}
                      >
                        <Icon className="mr-2 size-3.5" />
                        {entry.label}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => {
                      moreMenu.runAfterClose(() => {
                        void router.navigate({ to: "/bank/deposit" });
                      });
                    }}
                  >
                    <ArrowDownToLine className="mr-2 size-3.5" />
                    Deposit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => {
                      moreMenu.runAfterClose(() => {
                        void router.navigate({ to: "/bank/withdraw" });
                      });
                    }}
                  >
                    <ArrowUpFromLine className="mr-2 size-3.5" />
                    Withdraw
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          const Icon = ICONS[item.label as keyof typeof ICONS] ?? Home;
          const active = isActive(pathname, item);
          return (
            <SiteInternalLink
              key={item.label}
              siteKey={site.key}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </SiteInternalLink>
          );
        })}
      </div>
    </nav>
  );
}
