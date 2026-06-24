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
    <nav className={cn("-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border/60 px-4 pb-3 sm:mx-0 sm:mb-8 sm:flex-wrap sm:px-0 sm:pb-4 [&>*]:shrink-0 [&>*]:whitespace-nowrap", className)}>
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
