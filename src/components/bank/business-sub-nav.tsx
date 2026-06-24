import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

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
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          search={search}
          className={cn(
            "rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
            isActive(pathname, l)
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
