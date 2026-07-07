"use client";

import { memo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BankSubNavScroll, bankSubNavClass } from "@/components/bank/bank-scroll-contain";

type SectionLink = {
  to: string;
  label: string;
  exact?: boolean;
  params?: Record<string, string>;
};

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function extractCompanyTicker(pathname: string): string | null {
  const match = pathname.match(/^\/exchange\/company\/([^/]+)/);
  return match?.[1] ?? null;
}

function isSectionLinkActive(pathname: string, link: SectionLink): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(
    link.params ? link.to.replace("$ticker", link.params.ticker) : link.to,
  );

  if (link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

function resolveExchangeSectionLinks(pathname: string): { links: SectionLink[] } | null {
  const path = normalizePath(pathname);
  const ticker = extractCompanyTicker(path);

  if (ticker) {
    return {
      links: [
        {
          to: "/exchange/company/$ticker",
          params: { ticker },
          label: "Company profile",
          exact: true,
        },
        {
          to: "/exchange/company/$ticker/owner",
          params: { ticker },
          label: "Issuer portal",
        },
      ],
    };
  }

  if (path.startsWith("/exchange/api") || path.startsWith("/exchange/apply")) {
    return {
      links: [
        { to: "/exchange/api", label: "API access", exact: true },
        { to: "/exchange/apply", label: "Apply for access" },
      ],
    };
  }

  return null;
}

function SectionNavLink({ link, pathname }: { link: SectionLink; pathname: string }) {
  const active = isSectionLinkActive(pathname, link);

  return (
    <Link
      to={link.to}
      params={link.params}
      className={cn(
        "type-subnav rounded-md px-3 py-1.5 transition-colors",
        active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {link.label}
    </Link>
  );
}

export const ExchangeSubNav = memo(function ExchangeSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = resolveExchangeSectionLinks(pathname);

  if (!section?.links.length) return null;

  return (
    <BankSubNavScroll>
      <nav className={cn(bankSubNavClass, "mb-0 sm:mb-0")}>
        {section.links.map((link) => (
          <SectionNavLink
            key={`${link.to}-${link.label}-${link.params?.ticker ?? ""}`}
            link={link}
            pathname={pathname}
          />
        ))}
      </nav>
    </BankSubNavScroll>
  );
});
