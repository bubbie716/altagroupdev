"use client";

import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { NccWordmark } from "@/components/ncc/ncc-logo";
import { NccUserMenu } from "@/components/ncc/ncc-user-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import { SiteInternalLink } from "@/components/site/site-internal-link";

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

  return (
    <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-6 sm:px-8">
        <SiteInternalLink siteKey="ncc" to="/" className="shrink-0">
          <NccWordmark />
        </SiteInternalLink>

        <nav className="hidden items-center gap-1 lg:flex">
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
              className="rounded-sm border border-[#e5e7eb] px-3 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb]"
            >
              Account
            </SiteInternalLink>
          )}
          <div className="hidden sm:block">
            <NccUserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
