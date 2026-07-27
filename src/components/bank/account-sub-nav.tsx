"use client";

import { useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { RouteButton } from "@/components/bank/route-button";
import { BankSubNavScroll, bankSubNavInlineClass } from "@/components/bank/bank-scroll-contain";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { canAccessBusinessModule } from "@/lib/bank/business-account-access";
import type { CompanyRole } from "@/lib/auth/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canViewMerchantInvoices } from "@/lib/auth/permissions";
import {
  accountCommercialPath,
  accountCommercialRoutes,
} from "@/lib/bank/account-commercial-path";

type NavItem = {
  id: string;
  label: string;
  to: string;
  primary?: boolean;
  match: (pathname: string, accountId: string) => boolean;
};

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isExactAccountOverview(pathname: string, accountId: string): boolean {
  const base = `/bank/account/${accountId}`;
  const path = normalizePath(pathname);
  return path === normalizePath(base);
}

function isPathOrChild(pathname: string, target: string): boolean {
  const path = normalizePath(pathname);
  const normalized = normalizePath(target);
  return path === normalized || path.startsWith(`${normalized}/`);
}

function buildBusinessNavItems({
  role,
  showMerchant,
}: {
  role: CompanyRole;
  showMerchant: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    {
      id: "overview",
      label: "Overview",
      to: "/bank/account/$accountId",
      primary: true,
      match: (pathname, id) => isExactAccountOverview(pathname, id),
    },
    {
      id: "activity",
      label: "Activity",
      to: "/bank/account/$accountId/activity",
      primary: true,
      match: (pathname, id) => isPathOrChild(pathname, `/bank/account/${id}/activity`),
    },
  ];

  if (canAccessBusinessModule(role, "payments")) {
    items.push({
      id: "payments",
      label: "Payments",
      to: accountCommercialRoutes.payments,
      primary: true,
      match: (pathname, id) =>
        isPathOrChild(pathname, accountCommercialPath(id, "payments")),
    });
  }

  if (showMerchant) {
    items.push(
      {
        id: "invoices",
        label: "Invoices",
        to: accountCommercialRoutes.invoices,
        match: (pathname, id) =>
          isPathOrChild(pathname, accountCommercialPath(id, "invoices")),
      },
      {
        id: "payment-links",
        label: "Payment Links",
        to: accountCommercialRoutes.paymentLinks,
        match: (pathname, id) =>
          isPathOrChild(pathname, accountCommercialPath(id, "payment-links")),
      },
    );
  }

  if (canAccessBusinessModule(role, "payroll")) {
    items.push({
      id: "payroll",
      label: "Payroll",
      to: accountCommercialRoutes.payroll,
      match: (pathname, id) =>
        isPathOrChild(pathname, accountCommercialPath(id, "payroll")),
    });
  }

  if (showMerchant) {
    items.push({
      id: "analytics",
      label: "Analytics",
      to: accountCommercialRoutes.analytics,
      match: (pathname, id) =>
        isPathOrChild(pathname, accountCommercialPath(id, "analytics")),
    });
  }

  if (canAccessBusinessModule(role, "representatives")) {
    items.push({
      id: "team",
      label: "Team & permissions",
      to: "/bank/account/$accountId/representatives",
      match: (pathname, id) =>
        isPathOrChild(pathname, `/bank/account/${id}/representatives`),
    });
  }

  if (canAccessBusinessModule(role, "statements")) {
    items.push({
      id: "statements",
      label: "Statements",
      to: "/bank/account/$accountId/statements",
      match: (pathname, id) =>
        isPathOrChild(pathname, `/bank/account/${id}/statements`),
    });
  }

  if (showMerchant) {
    items.push({
      id: "settings",
      label: "Settings",
      to: accountCommercialRoutes.settings,
      match: (pathname, id) => {
        const settings = accountCommercialPath(id, "settings");
        const branding = accountCommercialPath(id, "branding");
        return isPathOrChild(pathname, settings) || isPathOrChild(pathname, branding);
      },
    });
  } else if (canAccessBusinessModule(role, "settings")) {
    items.push({
      id: "settings",
      label: "Settings",
      to: "/bank/account/$accountId/settings",
      match: (pathname, id) => isPathOrChild(pathname, `/bank/account/${id}/settings`),
    });
  }

  return items;
}

function navButtonClass(active: boolean, className?: string) {
  return cn(
    "type-subnav rounded-md px-3 py-1.5 transition-colors",
    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
    className,
  );
}

/** Flat business-account nav — primary row on mobile, full wrap on desktop. */
export function BusinessAccountSubNav({
  accountId,
  companyId,
  role,
}: {
  accountId: string;
  companyId: string;
  role: CompanyRole;
  /** @deprecated Payroll visibility is role-gated; page handles Core upgrade. */
  commercialPayrollEnabled?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const showMerchant =
    user !== null && canViewMerchantInvoices(user, { companyId });

  const items = useMemo(
    () => buildBusinessNavItems({ role, showMerchant }),
    [role, showMerchant],
  );

  const primaryItems = items.filter((item) => item.primary);
  const moreItems = items.filter((item) => !item.primary);
  const moreActive = moreItems.some((item) => item.match(pathname, accountId));

  return (
    <>
      {/* Mobile: Overview · Activity · Payments · More */}
      <div className="min-w-0 sm:hidden">
        <nav className="flex min-w-0 flex-wrap items-center gap-1" aria-label="Account">
          {primaryItems.map((item) => (
            <RouteButton
              key={item.id}
              to={item.to}
              params={{ accountId }}
              className={navButtonClass(item.match(pathname, accountId))}
            >
              {item.label}
            </RouteButton>
          ))}
          {moreItems.length > 0 ? (
            <button
              type="button"
              className={navButtonClass(moreActive || moreOpen, "inline-flex items-center gap-1")}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen(true)}
            >
              More
              <MoreHorizontal className="size-3.5 opacity-70" aria-hidden />
            </button>
          ) : null}
        </nav>

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl pb-8">
            <SheetHeader className="text-left">
              <SheetTitle>Account</SheetTitle>
              <SheetDescription>More pages for this business account.</SheetDescription>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1" aria-label="More account pages">
              {moreItems.map((item) => {
                const active = item.match(pathname, accountId);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-3 text-left text-[14px] font-medium transition-colors",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-foreground hover:bg-[var(--menu-item-hover)]",
                    )}
                    onClick={() => {
                      setMoreOpen(false);
                      void navigate({ to: item.to, params: { accountId } });
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop / tablet: full wrap row */}
      <BankSubNavScroll className="mb-0 hidden sm:mb-0 sm:block">
        <nav className={bankSubNavInlineClass} aria-label="Account">
          {items.map((item) => (
            <RouteButton
              key={item.id}
              to={item.to}
              params={{ accountId }}
              className={navButtonClass(item.match(pathname, accountId))}
            >
              {item.label}
            </RouteButton>
          ))}
        </nav>
      </BankSubNavScroll>
    </>
  );
}

export function PersonalAccountSubNav({ accountId }: { accountId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/bank/account/${accountId}`;

  const links = [
    { suffix: "", label: "Overview" },
    { suffix: "/activity", label: "Activity" },
    { suffix: "/statements", label: "Statements" },
  ] as const;

  return (
    <BankSubNavScroll className="mb-0 sm:mb-0">
      <nav className={bankSubNavInlineClass}>
        {links.map((l) => {
          const path = `${base}${l.suffix}`;
          const active =
            l.suffix === ""
              ? pathname === base || pathname === `${base}/`
              : pathname.startsWith(path);
          return (
            <RouteButton
              key={l.suffix}
              to={
                (l.suffix === ""
                  ? "/bank/account/$accountId"
                  : `/bank/account/$accountId${l.suffix}`) as string
              }
              params={{ accountId }}
              className={navButtonClass(active)}
            >
              {l.label}
            </RouteButton>
          );
        })}
      </nav>
    </BankSubNavScroll>
  );
}
