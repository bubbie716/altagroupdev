import { useRouterState } from "@tanstack/react-router";
import { SquareArrowOutUpRight } from "lucide-react";
import { MockDataNotice } from "@/components/data/mock-data-notice";
import { isPublicSimulatedMarketDataEnabled } from "@/lib/config/data-mode";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { RouteButton } from "@/components/bank/route-button";

const links = [
  { to: "/exchange", label: "Overview", exact: true },
  { to: "/exchange/listings", label: "Listings" },
  { to: "/exchange/ipo", label: "IPO Center" },
  { to: "/exchange/research", label: "Research" },
  { to: "/exchange/api", label: "API" },
  { to: "/terminal", label: "Terminal", separate: true },
] as const;

function isActive(pathname: string, link: (typeof links)[number]): boolean {
  if ("separate" in link && link.separate) return false;
  if ("exact" in link && link.exact) {
    return pathname === link.to || pathname === `${link.to}/`;
  }
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

export function ExchangeSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mb-10">
      {isPublicSimulatedMarketDataEnabled() && <MockDataNotice className="mb-4" />}
      <nav className="flex flex-wrap gap-1 border-b border-border/60 pb-4">
        {links.map((l) => {
          const active = isActive(pathname, l);
          return (
            <RouteButton
              key={l.to}
              to={l.to}
              className={cn(
                "type-subnav inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
              {"separate" in l && l.separate ? (
                <SquareArrowOutUpRight className="size-3 opacity-50" aria-hidden="true" />
              ) : null}
            </RouteButton>
          );
        })}
      </nav>
    </div>
  );
}
