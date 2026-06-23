import { Link, useRouterState } from "@tanstack/react-router";
import { MockDataNotice } from "@/components/data/mock-data-notice";
import { isPublicSimulatedMarketDataEnabled } from "@/lib/config/data-mode";
import { cn } from "@/lib/utils";

const links = [
  { to: "/exchange", label: "Overview", exact: true },
  { to: "/exchange/listings", label: "Listings" },
  { to: "/exchange/ipo", label: "IPO Center" },
  { to: "/exchange/apply", label: "List a Company" },
  { to: "/exchange/actions", label: "Corporate Actions" },
  { to: "/exchange/indices", label: "Indices" },
  { to: "/exchange/research", label: "Research" },
  { to: "/exchange/rankings", label: "Rankings" },
  { to: "/exchange/api", label: "API" },
] as const;

export function ExchangeSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mb-10">
      {isPublicSimulatedMarketDataEnabled() && <MockDataNotice className="mb-4" />}
      <nav className="flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const active = l.exact
          ? pathname === l.to
          : pathname === l.to || pathname.startsWith(`${l.to}/`);
        return (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
    </div>
  );
}
