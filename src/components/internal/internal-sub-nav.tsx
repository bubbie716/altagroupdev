import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { RouteButton } from "@/components/bank/route-button";

const links = [
  { to: "/internal", label: "Overview", exact: true },
  { to: "/internal/users", label: "Users", match: "/internal/users" },
  { to: "/internal/companies", label: "Companies", match: "/internal/companies" },
  { to: "/internal/bank", label: "Bank Ops" },
  { to: "/internal/lending", label: "Lending" },
  { to: "/internal/exchange", label: "Exchange Ops" },
  { to: "/internal/ipos", label: "IPO Applications" },
  { to: "/internal/api-applications", label: "API Applications" },
  { to: "/internal/listings", label: "Listings" },
  { to: "/internal/terminal", label: "Terminal Activity" },
  { to: "/internal/compliance", label: "Compliance" },
  { to: "/internal/embeds", label: "Embeds" },
  { to: "/internal/settings", label: "Settings" },
] as const;

export function InternalSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const active =
          "exact" in l && l.exact
            ? pathname === l.to
            : "match" in l
              ? pathname.startsWith(l.match)
              : pathname.startsWith(l.to);
        return (
          <RouteButton
            key={l.to}
            to={l.to}
            className={cn(
              "type-subnav-mono rounded-md px-3 py-1.5 transition-colors",
              active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </RouteButton>
        );
      })}
    </nav>
  );
}
