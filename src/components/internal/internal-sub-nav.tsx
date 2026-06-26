import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { RouteButton } from "@/components/bank/route-button";

type Link = { to: string; label: string; exact?: boolean; match?: string };

const groups: { id: string; label: string; links: Link[] }[] = [
  {
    id: "overview",
    label: "Overview",
    links: [
      { to: "/internal", label: "Dashboard", exact: true },
      { to: "/internal/exceptions", label: "Exceptions" },
      { to: "/internal/reports", label: "Reports" },
      { to: "/internal/audit", label: "Audit log" },
    ],
  },
  {
    id: "banking",
    label: "Banking",
    links: [
      { to: "/internal/bank", label: "Bank Ops", match: "/internal/bank" },
      { to: "/internal/bank/deposits", label: "Deposits" },
      { to: "/internal/bank/withdrawals", label: "Withdrawals" },
      { to: "/internal/bank/accounts", label: "Accounts", match: "/internal/bank/accounts" },
      { to: "/internal/bank/transactions", label: "Transactions", match: "/internal/bank/transactions" },
      { to: "/internal/bank/alta-pay", label: "Alta Pay" },
      { to: "/internal/bank/transfers", label: "Transfers" },
      { to: "/internal/bank/statements", label: "Statements" },
      { to: "/internal/lending", label: "Lending", exact: true },
    ],
  },
  {
    id: "identity",
    label: "Identity",
    links: [
      { to: "/internal/users", label: "Users", match: "/internal/users" },
      { to: "/internal/companies", label: "Companies", match: "/internal/companies" },
      { to: "/internal/compliance", label: "Compliance" },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    links: [
      { to: "/internal/exchange", label: "Exchange Ops" },
      { to: "/internal/ipos", label: "IPO Applications" },
      { to: "/internal/listings", label: "Listings" },
      { to: "/internal/terminal", label: "Terminal Activity" },
      { to: "/internal/api-applications", label: "API Applications" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    links: [
      { to: "/internal/embeds", label: "Embeds" },
      { to: "/internal/settings", label: "Settings" },
    ],
  },
];

function isActive(pathname: string, link: Link) {
  if (link.exact) return pathname === link.to;
  if (link.match) return pathname.startsWith(link.match);
  return pathname === link.to || pathname.startsWith(`${link.to}/`);
}

export function InternalSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Internal sections"
      className="-mx-4 mb-6 overflow-x-auto border-b border-border/60 px-4 pb-3 sm:mx-0 sm:mb-8 sm:px-0 sm:pb-4"
    >
      <ul className="flex min-w-max items-stretch gap-6 sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
        {groups.map((group) => (
          <li key={group.id} className="flex shrink-0 flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
              {group.label}
            </span>
            <div className="flex items-center gap-1">
              {group.links.map((l) => {
                const active = isActive(pathname, l);
                return (
                  <RouteButton
                    key={l.to}
                    to={l.to}
                    className={cn(
                      "type-subnav-mono whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors",
                      active
                        ? "bg-surface-2 text-foreground shadow-[inset_0_-2px_0_0] shadow-gold/70"
                        : "text-muted-foreground hover:bg-surface-2/50 hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </RouteButton>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </nav>
  );
}
