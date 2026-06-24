import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { RouteButton } from "@/components/bank/route-button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isPrivateClient } from "@/lib/auth/permissions";

const links = [
  { to: "/bank", label: "Dashboard", exact: true, activePaths: ["/bank/account"] },
  { to: "/bank/deposit", label: "Deposit" },
  { to: "/bank/withdraw", label: "Withdraw" },
  { to: "/bank/transfers", label: "Transfers", activePaths: ["/bank/transfers"] },
  { to: "/bank/pay", label: "Alta Pay" },
  { to: "/bank/statements", label: "Statements", activePaths: ["/bank/statements"] },
  { to: "/bank/products", label: "Products", activePaths: ["/bank/products", "/bank/deposits"] },
  { to: "/bank/lending", label: "Lending" },
  { to: "/bank/private", label: "Private", privateOnly: true },
] as const;

function isNavLinkActive(
  pathname: string,
  link: (typeof links)[number],
): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  if ("activePaths" in link && link.activePaths) {
    const accountActive = link.activePaths.some((target) => {
      const normalized = target.replace(/\/$/, "") || "/";
      return path === normalized || path.startsWith(`${normalized}/`);
    });
    if (accountActive) return true;
  }
  const target = link.to.replace(/\/$/, "") || "/";
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function BankSubNav({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const visibleLinks = links.filter(
    (l) => !("privateOnly" in l && l.privateOnly) || (user !== null && isPrivateClient(user)),
  );

  return (
    <nav className={cn("mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4", className)}>
      {visibleLinks.map((l) => {
        const active = isNavLinkActive(pathname, l);
        return (
          <RouteButton
            key={l.to}
            to={l.to}
            className={cn(
              "type-subnav rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </RouteButton>
        );
      })}
    </nav>
  );
}
