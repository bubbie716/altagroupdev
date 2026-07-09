import type { SiteKey } from "@/config/sites";

export type InternalNavLink = {
  label: string;
  to: string;
  exact?: boolean;
  match?: string;
};

export type InternalNavGroup = {
  id: string;
  label: string;
  links: InternalNavLink[];
};

/** Sidebar navigation — canonical queue routes under /internal/queues. */
export const INTERNAL_NAV_GROUPS: InternalNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    links: [{ to: "/internal", label: "Dashboard", exact: true }],
  },
  {
    id: "queues",
    label: "Queues",
    links: [
      { to: "/internal/queues/deposits", label: "Deposits", match: "/internal/queues/deposits" },
      { to: "/internal/queues/withdrawals", label: "Withdrawals", match: "/internal/queues/withdrawals" },
      {
        to: "/internal/queues/account-openings",
        label: "Account Openings",
        match: "/internal/queues/account-openings",
      },
      {
        to: "/internal/queues/company-verifications",
        label: "Company Verifications",
        match: "/internal/queues/company-verifications",
      },
      {
        to: "/internal/queues/lending-applications",
        label: "Lending Applications",
        match: "/internal/queues/lending-applications",
      },
      {
        to: "/internal/queues/alta-card-applications",
        label: "Alta Card Applications",
        match: "/internal/queues/alta-card-applications",
      },
      {
        to: "/internal/queues/alta-card-reviews",
        label: "Alta Card Reviews",
        match: "/internal/queues/alta-card-reviews",
      },
      { to: "/internal/queues/deal-rooms", label: "Deal Rooms", match: "/internal/queues/deal-rooms" },
      { to: "/internal/queues/exceptions", label: "Exceptions", match: "/internal/queues/exceptions" },
      {
        to: "/internal/queues/private-banking",
        label: "Private Banking",
        match: "/internal/queues/private-banking",
      },
    ],
  },
  {
    id: "explore",
    label: "Explore",
    links: [
      { to: "/internal/users", label: "Customers", match: "/internal/users" },
      { to: "/internal/companies", label: "Companies", match: "/internal/companies" },
      { to: "/internal/bank/accounts", label: "Accounts", match: "/internal/bank/accounts" },
      { to: "/internal/bank/transactions", label: "Transactions", match: "/internal/bank/transactions" },
      { to: "/internal/bank/interest", label: "Interest", match: "/internal/bank/interest" },
      { to: "/internal/bank/alta-pay", label: "Alta Pay" },
    ],
  },
  {
    id: "products",
    label: "Products",
    links: [
      { to: "/internal/lending", label: "Lending", match: "/internal/lending" },
      { to: "/internal/alta-card", label: "Alta Card", match: "/internal/alta-card" },
      { to: "/internal/alta-card/cards", label: "Alta Cards", match: "/internal/alta-card/cards" },
    ],
  },
  {
    id: "system",
    label: "System",
    links: [
      { to: "/internal/jobs", label: "Jobs", match: "/internal/jobs" },
      { to: "/internal/audit", label: "Audit" },
      { to: "/internal/reports", label: "Reports" },
      { to: "/internal/compliance", label: "Compliance" },
      { to: "/internal/settings", label: "Settings" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    links: [
      { to: "/internal/embeds", label: "Embeds" },
      { to: "/internal/relationships", label: "Relationships", match: "/internal/relationships" },
    ],
  },
];

/** Bank-only internal nav — excludes group platform settings. */
export const BANK_INTERNAL_NAV_GROUPS: InternalNavGroup[] = INTERNAL_NAV_GROUPS.map((group) => {
  if (group.id === "dashboard") {
    return {
      ...group,
      links: [{ to: "/internal/bank", label: "Dashboard", exact: true, match: "/internal/bank" }],
    };
  }
  if (group.id === "system") {
    return {
      ...group,
      links: [
        ...group.links.filter(
          (link) => link.to !== "/internal/settings" && link.to !== "/internal/compliance",
        ),
        { to: "/internal/bank/settings", label: "Settings", match: "/internal/bank/settings" },
      ],
    };
  }
  return group;
});

export function getInternalNavGroupsForSite(siteKey: SiteKey): InternalNavGroup[] | null {
  switch (siteKey) {
    case "corporate":
      return INTERNAL_NAV_GROUPS;
    case "bank":
      return BANK_INTERNAL_NAV_GROUPS;
    case "exchange":
    case "terminal":
    case "ncc":
      return null;
  }
}

export function isInternalNavActive(pathname: string, link: InternalNavLink): boolean {
  const path = pathname.replace(/\/$/, "") || "/";
  const target = link.to.replace(/\/$/, "") || "/";
  if (link.exact) return path === target;
  if (link.match) return path === link.match || path.startsWith(`${link.match}/`);
  return path === target || path.startsWith(`${target}/`);
}
