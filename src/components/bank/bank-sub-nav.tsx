import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isPrivateClient } from "@/lib/auth/permissions";

const links = [
  { to: "/bank", label: "Dashboard", exact: true },
  { to: "/bank/deposit", label: "Deposit" },
  { to: "/bank/withdraw", label: "Withdraw" },
  { to: "/bank/transfers", label: "Transfers", activePaths: ["/bank/transfers"] },
  { to: "/bank/products", label: "Products", activePaths: ["/bank/products", "/bank/deposits"] },
  { to: "/bank/lending", label: "Lending" },
  { to: "/bank/business", label: "Business" },
  { to: "/bank/private", label: "Private", privateOnly: true },
] as const;

function isNavLinkActive(
  pathname: string,
  link: (typeof links)[number],
): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  if ("activePaths" in link && link.activePaths) {
    return link.activePaths.some((target) => {
      const normalized = target.replace(/\/$/, "") || "/";
      return path === normalized || path.startsWith(`${normalized}/`);
    });
  }
  const target = link.to.replace(/\/$/, "") || "/";
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function BankSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const visibleLinks = links.filter(
    (l) => !("privateOnly" in l && l.privateOnly) || (user !== null && isPrivateClient(user)),
  );

  return (
    <nav className="mb-10 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {visibleLinks.map((l) => {
        const active = isNavLinkActive(pathname, l);
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
