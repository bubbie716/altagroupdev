import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isPrivateClient } from "@/lib/auth/permissions";

const links = [
  { to: "/bank", label: "Dashboard", exact: true },
  { to: "/bank/accounts", label: "Accounts" },
  { to: "/bank/transfers", label: "Transfers" },
  { to: "/bank/deposits", label: "Deposits" },
  { to: "/bank/lending", label: "Lending" },
  { to: "/bank/business", label: "Business" },
  { to: "/bank/private", label: "Private", privateOnly: true },
] as const;

export function BankSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const visibleLinks = links.filter(
    (l) => !("privateOnly" in l && l.privateOnly) || (user !== null && isPrivateClient(user)),
  );

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {visibleLinks.map((l) => {
        const normalizedPath = pathname.replace(/\/$/, "") || "/";
        const normalizedTo = l.to.replace(/\/$/, "") || "/";
        const active =
          "exact" in l && l.exact
            ? normalizedPath === normalizedTo
            : pathname.startsWith(l.to);
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
