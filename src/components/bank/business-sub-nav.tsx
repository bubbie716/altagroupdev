import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { RouteButton } from "@/components/bank/route-button";

const links = [
  { to: "/bank/business", label: "Overview", exact: true },
  { to: "/bank/business/payroll", label: "Payroll" },
  { to: "/bank/business/representatives", label: "Representatives" },
] as const;

function isActive(pathname: string, link: (typeof links)[number]): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = link.to.replace(/\/$/, "") || "/";
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function BusinessSubNav({ companyId }: { companyId?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = companyId ? { companyId } : undefined;

  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border/60 px-4 pb-3 sm:mx-0 sm:mb-8 sm:flex-wrap sm:px-0 sm:pb-4 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
      {links.map((l) => (
        <RouteButton
          key={l.to}
          to={l.to}
          search={search}
          className={cn(
            "type-subnav rounded-md px-3 py-1.5 transition-colors",
            isActive(pathname, l)
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.label}
        </RouteButton>
      ))}
    </nav>
  );
}
