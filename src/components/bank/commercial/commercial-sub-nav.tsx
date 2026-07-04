import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { RouteButton } from "@/components/bank/route-button";
import { BankSubNavScroll, bankSubNavClass } from "@/components/bank/bank-scroll-contain";
import { commercialCompanySearch } from "@/components/bank/commercial-account-back-link";

const links = [
  { to: "/bank/commercial", label: "Overview", exact: true },
  { to: "/bank/commercial/invoices", label: "Invoices" },
  { to: "/bank/commercial/payment-links", label: "Payment Links" },
  { to: "/bank/commercial/analytics", label: "Analytics" },
  { to: "/bank/commercial/settings", label: "Settings" },
] as const;

function isActive(pathname: string, link: (typeof links)[number]): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = link.to.replace(/\/$/, "") || "/";
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function CommercialSubNav({
  companyId,
  accountId,
  showAnalytics = true,
}: {
  companyId: string;
  accountId?: string;
  showAnalytics?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = commercialCompanySearch(companyId, accountId);
  const visibleLinks = showAnalytics
    ? links
    : links.filter((link) => link.to !== "/bank/commercial/analytics");

  return (
    <BankSubNavScroll>
      <nav className={bankSubNavClass}>
        {visibleLinks.map((link) => (
          <RouteButton
            key={link.to}
            to={link.to}
            search={search}
            className={cn(
              "type-subnav rounded-md px-3 py-1.5 transition-colors",
              isActive(pathname, link)
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </RouteButton>
        ))}
      </nav>
    </BankSubNavScroll>
  );
}
