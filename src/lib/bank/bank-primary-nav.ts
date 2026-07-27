import type { SiteNavLink } from "@/config/sites";
import type { CreditDeskCustomerNav } from "@/lib/platform/credit-desk-types";
import {
  FileText,
  HelpCircle,
  LayoutGrid,
  Settings,
  Shield,
  User,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BankPrimaryNavOptions = {
  creditDesk: CreditDeskCustomerNav;
};

/**
 * Desktop Bank primary destinations.
 * Alta Card / Lending are gated by credit-desk customer nav permissions.
 * Statements and Settings stay in the header; credit products are also listed on Products.
 */
export function buildBankDesktopPrimaryLinks(
  creditDesk: CreditDeskCustomerNav,
): SiteNavLink[] {
  const links: SiteNavLink[] = [
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

  if (creditDesk.showAltaCardNav) {
    links.push({
      label: "Alta Card",
      to: "/bank/alta-card",
      match: "/bank/alta-card",
      activePaths: ["/bank/alta-card"],
    });
  }

  if (creditDesk.showLendingNav) {
    links.push({
      label: creditDesk.creditDeskClosed ? "Loans" : "Lending",
      to: creditDesk.creditDeskClosed ? "/bank/lending/loans" : "/bank/lending",
      match: "/bank/lending",
      activePaths: ["/bank/lending"],
    });
  }

  links.push(
    {
      label: "Statements",
      to: "/bank/statements",
      match: "/bank/statements",
      activePaths: ["/bank/statements"],
    },
    {
      label: "Settings",
      to: "/bank/settings",
      match: "/bank/settings",
    },
  );

  return links;
}

/** @deprecated Use buildBankDesktopPrimaryLinks — kept for static fallbacks. */
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

/** Account avatar menu — products entry plus profile and support links. */
export function buildBankAccountMenuItems(options: {
  showInternal: boolean;
}): BankSecondaryNavItem[] {
  const items: BankSecondaryNavItem[] = [
    { label: "Products", to: "/bank/products", icon: LayoutGrid, group: "products" },
    { label: "Profile", to: "/profile", icon: User, group: "support" },
    { label: "Companies", to: "/companies", icon: Building2, group: "support" },
    { label: "Support", to: "/support", icon: HelpCircle, group: "support" },
  ];

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

/** Mobile More menu — destinations not in the bottom bar. */
export function buildBankMobileMoreItems(): BankSecondaryNavItem[] {
  return [
    { label: "Products", to: "/bank/products", icon: LayoutGrid, group: "products" },
    { label: "Statements", to: "/bank/statements", icon: FileText, group: "manage" },
    { label: "Settings", to: "/bank/settings", icon: Settings, group: "manage" },
  ];
}

/** @deprecated Use buildBankAccountMenuItems or buildBankMobileMoreItems. */
export function buildBankSecondaryNavItems(options: {
  creditDesk: CreditDeskCustomerNav;
  showInternal: boolean;
}): BankSecondaryNavItem[] {
  return [
    ...buildBankMobileMoreItems(),
    ...buildBankAccountMenuItems({ showInternal: options.showInternal }),
  ];
}

/** @deprecated Prefer buildBankDesktopPrimaryLinks. */
export function buildBankPrimaryNavLinks(options: BankPrimaryNavOptions): SiteNavLink[] {
  return buildBankDesktopPrimaryLinks(options.creditDesk);
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
