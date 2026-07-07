"use client";

import { memo } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { BankSubNavScroll, bankSubNavClass } from "@/components/bank/bank-scroll-contain";

type SectionLink = {
  to: string;
  label: string;
  exact?: boolean;
  search?: Record<string, string>;
  clearSearch?: boolean;
};

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function resolveTradeSubNavTab(searchStr: string): "ticket" | "orders" {
  const tab = new URLSearchParams(searchStr).get("tab");
  return tab === "orders" ? "orders" : "ticket";
}

function resolveTerminalSectionLinks(
  pathname: string,
  searchStr: string,
): { links: SectionLink[]; tradeTab?: "ticket" | "orders" } | null {
  const path = normalizePath(pathname);

  if (path.startsWith("/terminal/trade")) {
    const tradeTab = resolveTradeSubNavTab(searchStr);
    return {
      tradeTab,
      links: [
        { to: "/terminal/trade", label: "Trade ticket", clearSearch: true },
        { to: "/terminal/trade", label: "Orders", search: { tab: "orders" } },
      ],
    };
  }

  return null;
}

function isSectionLinkActive(
  pathname: string,
  searchStr: string,
  link: SectionLink,
  tradeTab?: "ticket" | "orders",
): boolean {
  if (tradeTab !== undefined && link.to === "/terminal/trade") {
    if (link.search?.tab === "orders") return tradeTab === "orders";
    return tradeTab === "ticket";
  }

  const path = normalizePath(pathname);
  const target = normalizePath(link.to);
  if (link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

function resolveSectionLinkSearch(
  link: SectionLink,
): Record<string, string> | ((prev: Record<string, unknown>) => Record<string, unknown>) | undefined {
  if (link.clearSearch) {
    return (prev) => {
      const { tab: _tab, ...rest } = prev;
      return rest;
    };
  }

  if (link.search?.tab) {
    const tab = link.search.tab;
    return (prev) => ({ ...prev, tab });
  }

  return link.search;
}

function SectionNavLink({
  link,
  pathname,
  searchStr,
  tradeTab,
}: {
  link: SectionLink;
  pathname: string;
  searchStr: string;
  tradeTab?: "ticket" | "orders";
}) {
  const active = isSectionLinkActive(pathname, searchStr, link, tradeTab);

  return (
    <Link
      to={link.to}
      search={resolveSectionLinkSearch(link)}
      className={cn(
        "type-subnav rounded-md px-3 py-1.5 transition-colors",
        active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {link.label}
    </Link>
  );
}

export const TerminalSubNav = memo(function TerminalSubNav() {
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  });
  const section = resolveTerminalSectionLinks(pathname, searchStr);

  if (!section?.links.length) return null;

  return (
    <BankSubNavScroll>
      <nav className={cn(bankSubNavClass, "mb-0 sm:mb-0")}>
        {section.links.map((link) => (
          <SectionNavLink
            key={`${link.to}-${link.label}-${link.search?.tab ?? ""}`}
            link={link}
            pathname={pathname}
            searchStr={searchStr}
            tradeTab={section.tradeTab}
          />
        ))}
      </nav>
    </BankSubNavScroll>
  );
});
