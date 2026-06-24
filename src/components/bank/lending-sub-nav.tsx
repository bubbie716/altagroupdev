import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { RouteButton } from "@/components/bank/route-button";

const links = [
  { to: "/bank/lending", label: "Overview", exact: true },
  { to: "/bank/lending/apply", label: "Apply" },
  { to: "/bank/lending/applications", label: "Applications" },
  { to: "/bank/lending/loans", label: "Loans" },
] as const;

export function LendingSubNav({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className={cn("mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-4", className)}>
      {links.map((l) => {
        const target = l.to.replace(/\/$/, "") || "/";
        const path = pathname.replace(/\/$/, "") || "/";
        const active =
          "exact" in l && l.exact ? path === target : path === target || path.startsWith(`${target}/`);
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
