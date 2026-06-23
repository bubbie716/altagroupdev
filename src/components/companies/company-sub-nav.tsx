import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function CompanySubNav({ companyId }: { companyId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/companies/${companyId}`;

  const links = [
    { to: "/companies/$companyId" as const, label: "Overview", exact: true },
    { to: "/companies/$companyId/members" as const, label: "Members" },
    { to: "/companies/$companyId/settings" as const, label: "Settings" },
  ] as const;

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const href =
          l.to === "/companies/$companyId"
            ? base
            : l.to === "/companies/$companyId/members"
              ? `${base}/members`
              : `${base}/settings`;
        const active = l.exact
          ? pathname === base || pathname === `${base}/`
          : pathname.startsWith(href);

        return (
          <Link
            key={l.to}
            to={l.to}
            params={{ companyId }}
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
