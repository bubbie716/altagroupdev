"use client";

import { memo, useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";
import { BankSubNavScroll, bankSubNavClass } from "@/components/bank/bank-scroll-contain";
import { commercialCompanySearch } from "@/components/bank/commercial-account-back-link";
import { fetchUnreadReceivedInvoiceCount } from "@/lib/bank/merchant-invoice.functions";
import type { AltaPaySubNavTab } from "@/components/bank/alta-pay-sub-nav";

type SectionLink = {
  to: string;
  label: string;
  exact?: boolean;
  search?: Record<string, string | undefined>;
  badge?: number;
  clearSearch?: boolean;
  /** Drop apply-modal query flags while keeping ?site= on localhost. */
  resetModalSearch?: boolean;
};

function preserveSiteSearch(
  prev: Record<string, unknown>,
  extra?: Record<string, string | undefined>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) next[key] = value;
    }
  }
  if (typeof prev.site === "string" && prev.site) next.site = prev.site;
  return next;
}

function stripModalSearch(prev: Record<string, unknown>): Record<string, unknown> {
  const {
    apply: _apply,
    product: _product,
    companyId: _companyId,
    ...rest
  } = prev;
  return preserveSiteSearch(rest);
}

const lendingSubLinks = [
  { to: "/bank/lending", label: "Lending", exact: true, resetModalSearch: true },
  { to: "/bank/lending/applications", label: "Applications", resetModalSearch: true },
  { to: "/bank/lending/loans", label: "Loans", resetModalSearch: true },
] as const;

const altaCardSubLinks = [
  { to: "/bank/alta-card", label: "Personal", resetModalSearch: true },
  { to: "/bank/alta-card/business", label: "Business", resetModalSearch: true },
] as const;

const businessSubLinks = [
  { to: "/bank/business", label: "Overview", exact: true },
  { to: "/bank/business/payroll", label: "Payroll" },
  { to: "/bank/business/representatives", label: "Representatives" },
] as const;

const commercialSubLinks = [
  { to: "/bank/commercial", label: "Overview", exact: true },
  { to: "/bank/commercial/invoices", label: "Invoices" },
  { to: "/bank/commercial/payment-links", label: "Payment Links" },
  { to: "/bank/commercial/analytics", label: "Analytics" },
  { to: "/bank/commercial/settings", label: "Settings" },
] as const;
function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isExactSectionLinkActive(pathname: string, link: { to: string; exact?: boolean }): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(link.to);
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

function isAltaCardSubLinkActive(pathname: string, link: (typeof altaCardSubLinks)[number]): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(link.to);
  if (target === "/bank/alta-card/business") {
    return path === target || path.startsWith(`${target}/`);
  }
  if (!path.startsWith("/bank/alta-card")) return false;
  return !path.startsWith("/bank/alta-card/business");
}

function resolveAltaPaySubNavTab(pathname: string, tab?: string): AltaPaySubNavTab {
  if (pathname.startsWith("/bank/pay/invoices")) return "invoices";
  if (tab === "scheduled" || tab === "recurring" || tab === "autopay") return tab;
  return "now";
}

function resolveBankSectionLinks(
  pathname: string,
  searchStr: string,
  unreadInvoiceCount: number,
): { links: SectionLink[]; altaPayTab?: AltaPaySubNavTab } | null {
  const path = normalizePath(pathname);
  const tabParam = new URLSearchParams(searchStr).get("tab") ?? undefined;
  const companyId = new URLSearchParams(searchStr).get("companyId") ?? undefined;
  const accountId = new URLSearchParams(searchStr).get("accountId") ?? undefined;
  const commercialSearch = companyId ? commercialCompanySearch(companyId, accountId ?? undefined) : undefined;

  if (path.startsWith("/bank/lending")) {
    return { links: lendingSubLinks.map((link) => ({ ...link })) };
  }

  if (path.startsWith("/bank/alta-card")) {
    return { links: altaCardSubLinks.map((link) => ({ ...link })) };
  }

  if (path.startsWith("/bank/pay")) {
    const altaPayTab = resolveAltaPaySubNavTab(pathname, tabParam);
    const links: SectionLink[] = [
      { to: "/bank", label: "Pay now", search: { action: "pay" }, clearSearch: false },
      {
        to: "/bank/pay/invoices",
        label: "Received invoices",
        badge: unreadInvoiceCount,
      },
      { to: "/bank/activity", label: "Scheduled", search: { view: "scheduled" } },
      { to: "/bank/activity", label: "AutoPay", search: { view: "autopay" } },
    ];
    return { links, altaPayTab };
  }

  if (path.startsWith("/bank/business")) {
    return {
      links: businessSubLinks.map((link) => ({
        ...link,
        search: companyId ? { companyId } : undefined,
      })),
    };
  }

  if (path.startsWith("/bank/commercial")) {
    return {
      links: commercialSubLinks.map((link) => ({
        ...link,
        search: commercialSearch,
      })),
    };
  }

  return null;
}

function isSectionLinkActive(
  pathname: string,
  searchStr: string,
  link: SectionLink,
  altaPayTab?: AltaPaySubNavTab,
): boolean {
  if (link.to === "/bank/alta-card" || link.to === "/bank/alta-card/business") {
    const altaLink = altaCardSubLinks.find((item) => item.to === link.to);
    if (altaLink) return isAltaCardSubLinkActive(pathname, altaLink);
  }

  if (altaPayTab !== undefined && link.to === "/bank") {
    return link.search?.action === "pay" && altaPayTab === "now";
  }

  if (altaPayTab !== undefined && link.to === "/bank/activity") {
    if (link.search?.view === "scheduled") return false;
    if (link.search?.view === "autopay") return false;
  }

  if (altaPayTab !== undefined && link.to === "/bank/pay") {
    if (link.search?.tab) return altaPayTab === link.search.tab;
    return altaPayTab === "now";
  }

  if (altaPayTab !== undefined && link.to === "/bank/pay/invoices") {
    return altaPayTab === "invoices";
  }

  return isExactSectionLinkActive(pathname, link);
}

function resolveSectionLinkSearch(
  link: SectionLink,
): Record<string, string> | ((prev: Record<string, unknown>) => Record<string, unknown>) {
  if (link.clearSearch) {
    return (prev) => preserveSiteSearch(prev);
  }

  if (link.search?.tab) {
    const tab = link.search.tab;
    return (prev) => preserveSiteSearch(prev, { tab });
  }

  if (link.resetModalSearch) {
    return (prev) => {
      const cleaned = stripModalSearch(prev);
      return link.search ? { ...cleaned, ...link.search } : cleaned;
    };
  }

  if (link.search) {
    return (prev) => preserveSiteSearch(prev, link.search);
  }

  // Default: keep ?site= and drop unrelated modal params so tab clicks fully navigate.
  return (prev) => stripModalSearch(prev);
}

function SectionNavLink({
  link,
  pathname,
  searchStr,
  altaPayTab,
}: {
  link: SectionLink;
  pathname: string;
  searchStr: string;
  altaPayTab?: AltaPaySubNavTab;
}) {
  const active = isSectionLinkActive(pathname, searchStr, link, altaPayTab);
  const linkClass = cn(
    "type-subnav rounded-md px-3 py-1.5 transition-colors",
    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
    link.badge !== undefined && link.badge > 0 && "inline-flex items-center gap-2",
  );

  return (
    <Link
      to={link.to}
      search={resolveSectionLinkSearch(link)}
      preload="intent"
      className={linkClass}
    >
      {link.label}
      {link.badge !== undefined && link.badge > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[11px] font-medium leading-none text-background tabular-nums">
          {link.badge > 99 ? "99+" : link.badge}
        </span>
      ) : null}
    </Link>
  );
}

export const BankSubNav = memo(function BankSubNav() {
  const { pathname, searchStr } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, searchStr: s.location.searchStr }),
  });
  const fetchUnreadCount = useServerFn(fetchUnreadReceivedInvoiceCount);
  const [unreadInvoiceCount, setUnreadInvoiceCount] = useState(0);

  useEffect(() => {
    if (!normalizePath(pathname).startsWith("/bank/pay")) return;

    let cancelled = false;
    void fetchUnreadCount()
      .then((count) => {
        if (!cancelled) setUnreadInvoiceCount(count);
      })
      .catch(() => {
        if (!cancelled) setUnreadInvoiceCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchUnreadCount, pathname]);

  const section = resolveBankSectionLinks(
    pathname,
    searchStr,
    unreadInvoiceCount,
  );

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
            altaPayTab={section.altaPayTab}
          />
        ))}
      </nav>
    </BankSubNavScroll>
  );
});
