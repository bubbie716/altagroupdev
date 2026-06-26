"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
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
  { to: "/bank/alta-card", label: "Alta Card", activePaths: ["/bank/alta-card"] },
  { to: "/bank/private", label: "Private", privateOnly: true },
] as const;

const lendingSubLinks = [
  { to: "/bank/lending", label: "Overview", exact: true },
  { to: "/bank/lending/apply", label: "Apply" },
  { to: "/bank/lending/applications", label: "Applications" },
  { to: "/bank/lending/loans", label: "Loans" },
] as const;

const altaCardSubLinks = [
  { to: "/bank/alta-card", label: "Personal" },
  { to: "/bank/alta-card/business", label: "Business" },
] as const;

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isNavLinkActive(
  pathname: string,
  link: (typeof links)[number],
): boolean {
  const path = normalizePath(pathname);
  if ("activePaths" in link && link.activePaths) {
    const accountActive = link.activePaths.some((target) => {
      const normalized = normalizePath(target);
      return path === normalized || path.startsWith(`${normalized}/`);
    });
    if (accountActive) return true;
  }
  const target = normalizePath(link.to);
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

function isLendingSubLinkActive(pathname: string, link: (typeof lendingSubLinks)[number]): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(link.to);
  if ("exact" in link && link.exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

function isAltaCardSubLinkActive(pathname: string, link: (typeof altaCardSubLinks)[number]): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(link.to);
  if (target === "/bank/alta-card/business") {
    return path === target || path.startsWith(`${target}/`);
  }
  if (!path.startsWith("/bank/alta-card")) return false;
  return !path.startsWith("/bank/alta-card/business");
}

function NavLink({
  to,
  label,
  active,
  className,
}: {
  to: string;
  label: string;
  active: boolean;
  className?: string;
}) {
  return (
    <RouteButton
      to={to}
      className={cn(
        "type-subnav rounded-md px-3 py-1.5 transition-colors",
        active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label}
    </RouteButton>
  );
}

function LendingNavGroup({ pathname, active }: { pathname: string; active: boolean }) {
  const expanded = normalizePath(pathname).startsWith("/bank/lending");

  return (
    <motion.div layout className="flex items-center gap-1">
      <motion.div layout="position">
        <NavLink to="/bank/lending" label="Lending" active={active} />
      </motion.div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="lending-sublinks"
            layout
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-1 overflow-hidden"
          >
            <motion.span
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="mx-0.5 h-4 w-px origin-center bg-border/80"
              aria-hidden
            />
            {lendingSubLinks.map((subLink, index) => (
              <motion.div
                key={subLink.to}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{
                  duration: 0.22,
                  delay: index * 0.045,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <RouteButton
                  to={subLink.to}
                  className={cn(
                    "type-subnav rounded-md px-3 py-1.5 transition-colors",
                    isLendingSubLinkActive(pathname, subLink)
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {subLink.label}
                </RouteButton>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function AltaCardNavGroup({ pathname, active }: { pathname: string; active: boolean }) {
  const expanded = normalizePath(pathname).startsWith("/bank/alta-card");

  return (
    <motion.div layout className="flex items-center gap-1">
      <motion.div layout="position">
        <NavLink to="/bank/alta-card" label="Alta Card" active={active} />
      </motion.div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="alta-card-sublinks"
            layout
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-1 overflow-hidden"
          >
            <motion.span
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="mx-0.5 h-4 w-px origin-center bg-border/80"
              aria-hidden
            />
            {altaCardSubLinks.map((subLink, index) => (
              <motion.div
                key={subLink.to}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{
                  duration: 0.22,
                  delay: index * 0.045,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <RouteButton
                  to={subLink.to}
                  className={cn(
                    "type-subnav rounded-md px-3 py-1.5 transition-colors",
                    isAltaCardSubLinkActive(pathname, subLink)
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {subLink.label}
                </RouteButton>
              </motion.div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export function BankSubNav({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const visibleLinks = links.filter(
    (l) => !("privateOnly" in l && l.privateOnly) || (user !== null && isPrivateClient(user)),
  );

  return (
    <LayoutGroup id="bank-sub-nav">
      <nav
        className={cn(
          "-mx-4 mb-8 flex gap-1 overflow-x-auto border-b border-border/60 px-4 pb-3 sm:mx-0 sm:mb-10 sm:flex-wrap sm:px-0 sm:pb-4 [&>*]:shrink-0 [&>*]:whitespace-nowrap",
          className,
        )}
      >
        {visibleLinks.map((link) => {
          if (link.to === "/bank/lending") {
            return (
              <LendingNavGroup
                key={link.to}
                pathname={pathname}
                active={isNavLinkActive(pathname, link)}
              />
            );
          }
          if (link.to === "/bank/alta-card") {
            return (
              <AltaCardNavGroup
                key={link.to}
                pathname={pathname}
                active={isNavLinkActive(pathname, link)}
              />
            );
          }
          return (
            <motion.div layout="position" key={link.to}>
              <NavLink
                to={link.to}
                label={link.label}
                active={isNavLinkActive(pathname, link)}
              />
            </motion.div>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
