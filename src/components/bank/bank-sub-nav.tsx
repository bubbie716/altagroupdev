import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const links = [
  { to: "/bank/dashboard", label: "Dashboard" },
  { to: "/bank/accounts", label: "Accounts" },
  { to: "/bank/transfers", label: "Transfers" },
  { to: "/bank/deposits", label: "Deposits" },
  { to: "/bank/lending", label: "Lending" },
  { to: "/bank/business", label: "Business" },
  { to: "/bank/private", label: "Private" },
] as const;

export function BankSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
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
