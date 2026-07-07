"use client";

import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { NccLogo } from "@/components/ncc/ncc-logo";
import { NccUserMenu } from "@/components/ncc/ncc-user-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SiteInternalLink } from "@/components/site/site-internal-link";
import { EcosystemSwitcher, EcosystemSwitcherMobileSection } from "@/components/site/ecosystem-switcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navLinks = [
  { to: "/", label: "Home", exact: true },
  { to: "/institutions", label: "Institutions" },
  { to: "/participation", label: "Participation" },
  { to: "/network", label: "Network" },
  { to: "/legal", label: "Legal" },
  { to: "/support", label: "Support" },
] as const;

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isActive(pathname: string, link: (typeof navLinks)[number]): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(link.to);
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function NccNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);

  const mobileLinkClass = (active: boolean) =>
    cn(
      "rounded-sm px-3 py-3 text-[14px] font-medium transition-colors",
      active ? "bg-[#e8f2ed] text-[#0c4d32]" : "text-[#4b5563] hover:bg-[#f9fafb] hover:text-[#111827]",
    );

  return (
    <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <SiteInternalLink siteKey="ncc" to="/" className="shrink-0 rounded-sm p-0.5" aria-label="NCC home">
            <NccLogo size="md" />
          </SiteInternalLink>
          <EcosystemSwitcher siteKey="ncc" variant="ncc" />
        </div>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {navLinks.map((link) => {
            const active = isActive(pathname, link);
            return (
              <SiteInternalLink
                key={link.to}
                siteKey="ncc"
                to={link.to}
                className={cn(
                  "rounded-sm px-3 py-2 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#e8f2ed] text-[#0c4d32]"
                    : "text-[#4b5563] hover:bg-[#f9fafb] hover:text-[#111827]",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </SiteInternalLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <SiteInternalLink
              siteKey="ncc"
              to="/dashboard"
              className="hidden rounded-sm border border-[#e5e7eb] px-3 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] sm:inline-flex"
            >
              Console
            </SiteInternalLink>
          ) : (
            <SiteInternalLink
              siteKey="ncc"
              to="/login"
              className="hidden rounded-sm border border-[#e5e7eb] px-3 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb] sm:inline-flex"
            >
              Account
            </SiteInternalLink>
          )}
          <div className="hidden sm:block">
            <NccUserMenu />
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Open menu"
                className="inline-flex rounded-sm border border-[#e5e7eb] p-2 text-[#4b5563] hover:bg-[#f9fafb] lg:hidden"
              >
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto bg-white p-0">
              <SheetHeader className="border-b border-[#e5e7eb] px-5 py-4 text-left">
                <SheetTitle className="text-left text-[15px] font-semibold text-[#111827]">
                  Newport Clearing Corporation
                </SheetTitle>
              </SheetHeader>
              <EcosystemSwitcherMobileSection
                siteKey="ncc"
                variant="ncc"
                onNavigate={() => setMobileOpen(false)}
              />
              <nav className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => {
                  const active = isActive(pathname, link);
                  return (
                    <SiteInternalLink
                      key={link.to}
                      siteKey="ncc"
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className={mobileLinkClass(active)}
                      aria-current={active ? "page" : undefined}
                    >
                      {link.label}
                    </SiteInternalLink>
                  );
                })}
              </nav>
              <div className="border-t border-[#e5e7eb] p-4">
                {user ? (
                  <SiteInternalLink
                    siteKey="ncc"
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="mb-3 block rounded-sm border border-[#e5e7eb] px-3 py-3 text-center text-[14px] font-medium text-[#374151]"
                  >
                    Console
                  </SiteInternalLink>
                ) : (
                  <SiteInternalLink
                    siteKey="ncc"
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="mb-3 block rounded-sm border border-[#e5e7eb] px-3 py-3 text-center text-[14px] font-medium text-[#374151]"
                  >
                    Account
                  </SiteInternalLink>
                )}
                <NccUserMenu />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
