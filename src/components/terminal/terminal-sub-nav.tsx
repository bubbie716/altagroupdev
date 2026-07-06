import { useRouterState } from "@tanstack/react-router";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSiteContext } from "@/hooks/use-site-context";
import { resolveEntitySiteUrl } from "@/lib/site/entity-site-url";
import { SiteInternalLink } from "@/components/site/site-internal-link";

const links = [
  { to: "/terminal", label: "Overview", exact: true },
  { to: "/terminal/portfolio", label: "Portfolio" },
  { to: "/terminal/watchlist", label: "Watchlist" },
  { to: "/terminal/trade", label: "Trade" },
  { to: "/terminal/research", label: "Research" },
  { to: "/terminal/ipo", label: "IPO Access" },
  { to: "/terminal/news", label: "News" },
  { to: "/terminal/leaderboard", label: "Leaderboard" },
  { to: "/exchange", label: "Exchange", separate: true, externalSite: "exchange" as const },
] as const;

function isActive(pathname: string, link: (typeof links)[number]): boolean {
  if ("separate" in link && link.separate) return false;
  if ("exact" in link && link.exact) {
    return pathname === link.to || pathname === `${link.to}/`;
  }
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

export function TerminalSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const site = useSiteContext();

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const active = isActive(pathname, l);
        const className = cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
          active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
        );

        if ("externalSite" in l && l.externalSite) {
          return (
            <a
              key={l.to}
              href={resolveEntitySiteUrl(l.externalSite, l.to)}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {l.label}
              <SquareArrowOutUpRight className="size-3 opacity-50" aria-hidden="true" />
            </a>
          );
        }

        return (
          <SiteInternalLink key={l.to} siteKey={site.key} to={l.to} className={className}>
            {l.label}
          </SiteInternalLink>
        );
      })}
    </nav>
  );
}
