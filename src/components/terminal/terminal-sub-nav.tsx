import { Link, useRouterState } from "@tanstack/react-router";
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
] as const;

export function TerminalSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
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
  );
}
