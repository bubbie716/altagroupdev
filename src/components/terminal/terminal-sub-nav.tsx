import { Link, useRouterState } from "@tanstack/react-router";
import { SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/terminal", label: "Overview", exact: true },
  { to: "/terminal/portfolio", label: "Portfolio" },
  { to: "/terminal/watchlist", label: "Watchlist" },
  { to: "/terminal/trade", label: "Trade" },
  { to: "/terminal/research", label: "Research" },
  { to: "/terminal/ipo", label: "IPO Access" },
  { to: "/terminal/news", label: "News" },
  { to: "/terminal/leaderboard", label: "Leaderboard" },
  { to: "/exchange", label: "Exchange", separate: true },
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

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const active = isActive(pathname, l);
        return (
          <Link
            key={l.to}
            to={l.to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
            {"separate" in l && l.separate ? (
              <SquareArrowOutUpRight className="size-3 opacity-50" aria-hidden="true" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
