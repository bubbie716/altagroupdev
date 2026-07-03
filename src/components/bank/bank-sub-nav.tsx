"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { RouteButton } from "@/components/bank/route-button";
import { BankSubNavScroll, bankSubNavClass } from "@/components/bank/bank-scroll-contain";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useCreditDeskCustomerNav } from "@/hooks/use-credit-desk-nav";
import type { AltaPrivateClientContext } from "@/lib/bank/alta-private-client.types";
import { isPrivateClient } from "@/lib/auth/permissions";

const links = [
  { to: "/bank", label: "Dashboard", exact: true, activePaths: ["/bank/account"] },
  { to: "/bank/deposit", label: "Deposit" },
  { to: "/bank/withdraw", label: "Withdraw" },
  { to: "/bank/transfers", label: "Transfers", activePaths: ["/bank/transfers"] },
  { to: "/bank/pay", label: "Alta Pay" },
  { to: "/bank/settings", label: "Settings" },
  { to: "/bank/statements", label: "Statements", activePaths: ["/bank/statements"] },
  { to: "/bank/products", label: "Products", activePaths: ["/bank/products", "/bank/deposits"] },
  { to: "/bank/lending", label: "Lending" },
  { to: "/bank/alta-card", label: "Alta Card", activePaths: ["/bank/alta-card"] },
  { to: "/bank/private", label: "Alta Private", membersOnly: true },
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

const subNavEase = [0.22, 1, 0.36, 1] as const;

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

function LendingNavGroup({
  pathname,
  active,
  showApply = true,
}: {
  pathname: string;
  active: boolean;
  showApply?: boolean;
}) {
  const expanded = normalizePath(pathname).startsWith("/bank/lending");
  const subLinks = showApply
    ? lendingSubLinks
    : lendingSubLinks.filter((link) => link.to !== "/bank/lending/apply");

  return (
    <div className="flex items-center gap-1">
      <NavLink to="/bank/lending" label="Lending" active={active} />
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="lending-sublinks"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.28, ease: subNavEase }}
            className="flex items-center gap-1 overflow-hidden"
          >
            <motion.span
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: subNavEase }}
              className="mx-0.5 h-4 w-px origin-center bg-border/80"
              aria-hidden
            />
            {subLinks.map((subLink, index) => (
              <motion.div
                key={subLink.to}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{
                  duration: 0.22,
                  delay: index * 0.045,
                  ease: subNavEase,
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
    </div>
  );
}

function AltaCardNavGroup({
  pathname,
  active,
}: {
  pathname: string;
  active: boolean;
}) {
  const expanded = normalizePath(pathname).startsWith("/bank/alta-card");

  return (
    <div className="flex items-center gap-1">
      <NavLink to="/bank/alta-card" label="Alta Card" active={active} />
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="alta-card-sublinks"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.28, ease: subNavEase }}
            className="flex items-center gap-1 overflow-hidden"
          >
            <motion.span
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: subNavEase }}
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
                  ease: subNavEase,
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
    </div>
  );
}

export const BankSubNav = memo(function BankSubNav({
  className,
  privateClientContext,
}: {
  className?: string;
  privateClientContext?: AltaPrivateClientContext;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const user = useCurrentUser();
  const creditDeskNav = useCreditDeskCustomerNav();
  const isMember = privateClientContext?.isMember ?? (user !== null && isPrivateClient(user));
  const visibleLinks = links.filter((l) => {
    if ("membersOnly" in l && l.membersOnly) return isMember;
    if ("privateOnly" in l && l.privateOnly) return isMember;
    return true;
  });

  const navLinks = visibleLinks.filter((link) => {
    if (link.to === "/bank/lending") {
      if (creditDeskNav.showLendingNav) return true;
      return false;
    }
    if (link.to === "/bank/alta-card") {
      if (creditDeskNav.showAltaCardNav) return true;
      return false;
    }
    return true;
  });

  return (
    <BankSubNavScroll className="sm:mb-10">
      <nav className={cn(bankSubNavClass, "mb-0 sm:mb-0", className)}>
        {navLinks.map((link) => {
          if (link.to === "/bank/lending") {
            if (creditDeskNav.creditDeskClosed && creditDeskNav.showLendingNav) {
              return (
                <NavLink
                  key="loans-servicing"
                  to="/bank/lending/loans"
                  label="Loans"
                  active={normalizePath(pathname).startsWith("/bank/lending")}
                />
              );
            }
            return (
              <LendingNavGroup
                key={link.to}
                pathname={pathname}
                active={isNavLinkActive(pathname, link)}
                showApply={creditDeskNav.showApplyEntryPoints}
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
            <NavLink
              key={link.to}
              to={link.to}
              label={link.label}
              active={isNavLinkActive(pathname, link)}
            />
          );
        })}
      </nav>
    </BankSubNavScroll>
  );
});
