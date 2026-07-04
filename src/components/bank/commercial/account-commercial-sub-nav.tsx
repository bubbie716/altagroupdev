"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { RouteButton } from "@/components/bank/route-button";
import {
  accountCommercialPath,
  accountCommercialRoutes,
  isAccountCommercialPath,
} from "@/lib/bank/account-commercial-path";

const subNavEase = [0.22, 1, 0.36, 1] as const;

type CommercialSubLink = {
  segment: "invoices" | "payment-links" | "analytics" | "settings" | "payroll";
  label: string;
  merchantOnly?: boolean;
  payrollOnly?: boolean;
};

const commercialSubLinks: CommercialSubLink[] = [
  { segment: "invoices", label: "Invoices", merchantOnly: true },
  { segment: "payment-links", label: "Payment Links", merchantOnly: true },
  { segment: "payroll", label: "Payroll", payrollOnly: true },
  { segment: "analytics", label: "Analytics", merchantOnly: true },
  { segment: "settings", label: "Settings", merchantOnly: true },
];

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isCommercialSubLinkActive(
  pathname: string,
  accountId: string,
  segment: string,
): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(accountCommercialPath(accountId, segment as CommercialSubLink["segment"]));
  return path === target || path.startsWith(`${target}/`);
}

export function AccountCommercialNavGroup({
  accountId,
  active,
  showMerchant = true,
  showPayroll = false,
  showAnalytics = true,
}: {
  accountId: string;
  active: boolean;
  showMerchant?: boolean;
  showPayroll?: boolean;
  showAnalytics?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const expanded = isAccountCommercialPath(pathname, accountId);

  const subLinks = commercialSubLinks.filter((link) => {
    if (link.merchantOnly && !showMerchant) return false;
    if (link.payrollOnly && !showPayroll) return false;
    if (link.segment === "analytics" && !showAnalytics) return false;
    return true;
  });

  return (
    <div className="flex items-center gap-1">
      <RouteButton
        to={showMerchant ? accountCommercialRoutes.overview : accountCommercialRoutes.payroll}
        params={{ accountId }}
        className={cn(
          "type-subnav rounded-md px-3 py-1.5 transition-colors",
          active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        Commercial
      </RouteButton>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="commercial-sublinks"
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
                key={subLink.segment}
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
                  to={accountCommercialPath(accountId, subLink.segment)}
                  params={{ accountId }}
                  className={cn(
                    "type-subnav rounded-md px-3 py-1.5 transition-colors",
                    isCommercialSubLinkActive(pathname, accountId, subLink.segment)
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
