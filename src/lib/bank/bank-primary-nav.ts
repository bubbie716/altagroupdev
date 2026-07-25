import type { SiteNavLink } from "@/config/sites";
import type { CreditDeskCustomerNav } from "@/lib/platform/credit-desk-types";
import {
  CreditCard,
  FileText,
  HandCoins,
  HelpCircle,
  LayoutGrid,
  Settings,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BankPrimaryNavOptions = {
  creditDesk: CreditDeskCustomerNav;
};

/** Primary destinations — Home, Accounts, Activity only. */
export const BANK_HOME_PRIMARY_LINKS: SiteNavLink[] = [
  {
    label: "Home",
    to: "/bank",
    exact: true,
    match: "/bank",
  },
  {
    label: "Accounts",
    to: "/bank/accounts",
    match: "/bank/accounts",
    activePaths: ["/bank/account", "/bank/open"],
  },
  {
    label: "Activity",
    to: "/bank/activity",
    match: "/bank/activity",
  },
];

export type BankSecondaryNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  group: "products" | "manage" | "support";
};

export function buildBankSecondaryNavItems(options: {
  creditDesk: CreditDeskCustomerNav;
  showInternal: boolean;
}): BankSecondaryNavItem[] {
  const items: BankSecondaryNavItem[] = [];

  if (options.creditDesk.showAltaCardNav) {
    items.push({
      label: "Alta Card",
      to: "/bank/alta-card",
      icon: CreditCard,
      group: "products",
    });
  }

  if (options.creditDesk.showLendingNav) {
    items.push({
      label: options.creditDesk.creditDeskClosed ? "Loans" : "Lending",
      to: options.creditDesk.creditDeskClosed ? "/bank/lending/loans" : "/bank/lending",
      icon: HandCoins,
      group: "products",
    });
  }

  items.push(
    { label: "Products", to: "/bank/products", icon: LayoutGrid, group: "products" },
    { label: "Statements", to: "/bank/statements", icon: FileText, group: "manage" },
    { label: "Settings", to: "/bank/settings", icon: Settings, group: "manage" },
    { label: "Support", to: "/profile", icon: HelpCircle, group: "support" },
  );

  if (options.showInternal) {
    items.push({
      label: "Internal console",
      to: "/internal",
      icon: Shield,
      group: "support",
    });
  }

  return items;
}

/** @deprecated Prefer BANK_HOME_PRIMARY_LINKS; kept for SiteNav fallback callers. */
export function buildBankPrimaryNavLinks(_options: BankPrimaryNavOptions): SiteNavLink[] {
  return BANK_HOME_PRIMARY_LINKS;
}

export type BankMobileNavItem = {
  label: string;
  to: string;
  exact?: boolean;
  match?: string;
  activePaths?: string[];
  kind: "link" | "more";
};

export const BANK_MOBILE_NAV_ITEMS: BankMobileNavItem[] = [
  { label: "Home", to: "/bank", exact: true, match: "/bank", kind: "link" },
  {
    label: "Accounts",
    to: "/bank/accounts",
    match: "/bank/accounts",
    activePaths: ["/bank/account", "/bank/open"],
    kind: "link",
  },
  { label: "Activity", to: "/bank/activity", match: "/bank/activity", kind: "link" },
  { label: "More", to: "#more", kind: "more" },
];
