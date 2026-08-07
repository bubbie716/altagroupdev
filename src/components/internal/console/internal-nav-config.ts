import type { SiteKey } from "@/config/sites";
import type { AltaUser } from "@/lib/auth/types";
import { isInternalPathAllowedForUser } from "@/lib/internal/entity-internal-scope";

export type InternalNavLink = {
  label: string;
  to: string;
  exact?: boolean;
  match?: string;
  /** Extra path prefixes that activate this primary item. */
  matchPrefixes?: string[];
};

export type InternalNavGroup = {
  id: string;
  label: string;
  links: InternalNavLink[];
};

export type InternalPrimarySectionId =
  | "home"
  | "inbox"
  | "directory"
  | "customers"
  | "investors"
  | "portfolios"
  | "orders"
  | "money"
  | "products"
  | "system"
  | "maintenance";

export type InternalContextualNav = {
  sectionId: InternalPrimarySectionId;
  label: string;
  links: InternalNavLink[];
  /** Compact overflow group (e.g. Money → Operations). */
  overflow?: {
    label: string;
    links: InternalNavLink[];
  };
};

/** Corporate — group administration only; subsidiary operations live on their own sites. */
export const CORPORATE_PRIMARY_NAV: InternalNavLink[] = [
  { label: "Home", to: "/internal", exact: true, matchPrefixes: [] },
  { label: "Inbox", to: "/internal/inbox", match: "/internal/inbox", matchPrefixes: ["/internal/queues"] },
  {
    label: "Directory",
    to: "/internal/users",
    matchPrefixes: ["/internal/users", "/internal/companies", "/internal/relationships"],
  },
  {
    label: "System",
    to: "/internal/jobs",
    matchPrefixes: [
      "/internal/jobs",
      "/internal/audit",
      "/internal/reports",
      "/internal/compliance",
      "/internal/settings",
      "/internal/embeds",
    ],
  },
];

/** Bank — six primary destinations (Directory labeled Customers). */
export const BANK_PRIMARY_NAV: InternalNavLink[] = [
  {
    label: "Home",
    to: "/internal/bank",
    exact: true,
    match: "/internal/bank",
    matchPrefixes: [],
  },
  { label: "Inbox", to: "/internal/inbox", match: "/internal/inbox", matchPrefixes: ["/internal/queues"] },
  {
    label: "Customers",
    to: "/internal/users",
    matchPrefixes: ["/internal/users", "/internal/companies", "/internal/relationships"],
  },
  {
    label: "Money",
    to: "/internal/bank/accounts",
    matchPrefixes: [
      "/internal/bank/accounts",
      "/internal/bank/transactions",
      "/internal/bank/transfers",
      "/internal/bank/alta-pay",
      "/internal/bank/scheduled",
      "/internal/bank/statements",
      "/internal/bank/interest",
    ],
  },
  {
    label: "Products",
    to: "/internal/lending",
    matchPrefixes: ["/internal/lending", "/internal/alta-card"],
  },
  {
    label: "System",
    to: "/internal/jobs",
    matchPrefixes: ["/internal/jobs", "/internal/audit", "/internal/reports", "/internal/bank/settings"],
  },
];

/** Terminal — six primary destinations (task-oriented). */
export const TERMINAL_PRIMARY_NAV: InternalNavLink[] = [
  { label: "Home", to: "/internal", exact: true, matchPrefixes: [] },
  {
    label: "Inbox",
    to: "/internal/terminal/inbox",
    match: "/internal/terminal/inbox",
    matchPrefixes: [],
  },
  {
    label: "Investors",
    to: "/internal/terminal/investors",
    matchPrefixes: ["/internal/terminal/investors", "/internal/users", "/internal/companies"],
  },
  {
    label: "Portfolios",
    to: "/internal/terminal/portfolios",
    match: "/internal/terminal/portfolios",
    matchPrefixes: [],
  },
  {
    label: "Orders",
    to: "/internal/terminal/orders",
    match: "/internal/terminal/orders",
    matchPrefixes: [],
  },
  {
    label: "System",
    to: "/internal/terminal/system",
    matchPrefixes: ["/internal/terminal/system", "/internal/terminal/settings", "/internal/terminal/crypto"],
  },
];

export const EXCHANGE_PRIMARY_NAV: InternalNavLink[] = [
  { label: "Home", to: "/internal", exact: true },
  {
    label: "Maintenance",
    to: "/internal/exchange/settings",
    match: "/internal/exchange/settings",
    matchPrefixes: ["/internal/exchange"],
  },
];

/** @deprecated Prefer getInternalPrimaryNav — kept as group wrapper for shared nav renderer. */
export const INTERNAL_NAV_GROUPS: InternalNavGroup[] = [
  { id: "primary", label: "Navigate", links: CORPORATE_PRIMARY_NAV },
];

export const BANK_INTERNAL_NAV_GROUPS: InternalNavGroup[] = [
  { id: "primary", label: "Navigate", links: BANK_PRIMARY_NAV },
];

export const TERMINAL_INTERNAL_NAV_GROUPS: InternalNavGroup[] = [
  { id: "primary", label: "Navigate", links: TERMINAL_PRIMARY_NAV },
];

export const EXCHANGE_INTERNAL_NAV_GROUPS: InternalNavGroup[] = [
  { id: "primary", label: "Navigate", links: EXCHANGE_PRIMARY_NAV },
];

export function getInternalPrimaryNav(siteKey: SiteKey): InternalNavLink[] {
  switch (siteKey) {
    case "corporate":
    case "accounting":
      return CORPORATE_PRIMARY_NAV;
    case "bank":
      return BANK_PRIMARY_NAV;
    case "terminal":
      return TERMINAL_PRIMARY_NAV;
    case "exchange":
      return EXCHANGE_PRIMARY_NAV;
  }
}

export function getInternalNavGroupsForSite(siteKey: SiteKey): InternalNavGroup[] | null {
  switch (siteKey) {
    case "corporate":
    case "accounting":
      return INTERNAL_NAV_GROUPS;
    case "bank":
      return BANK_INTERNAL_NAV_GROUPS;
    case "exchange":
      return EXCHANGE_INTERNAL_NAV_GROUPS;
    case "terminal":
      return TERMINAL_INTERNAL_NAV_GROUPS;
  }
}

/** Drop links the current staff role cannot open on this site. */
export function filterInternalNavGroupsForAccess(
  groups: InternalNavGroup[],
  siteKey: SiteKey,
  user?: AltaUser | null,
): InternalNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => isInternalPathAllowedForUser(siteKey, link.to, user)),
    }))
    .filter((group) => group.links.length > 0);
}

export function filterInternalNavLinksForAccess(
  links: InternalNavLink[],
  siteKey: SiteKey,
  user?: AltaUser | null,
): InternalNavLink[] {
  return links.filter((link) => isInternalPathAllowedForUser(siteKey, link.to, user));
}

export function isInternalNavActive(pathname: string, link: InternalNavLink): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(link.to);

  if (link.exact) {
    if (path === target) return true;
    // Bank home: exact /internal/bank but not /internal/bank/accounts
    if (link.match && path === normalizePath(link.match)) return true;
    return false;
  }

  if (link.match) {
    const m = normalizePath(link.match);
    if (path === m || path.startsWith(`${m}/`)) return true;
  }

  for (const prefix of link.matchPrefixes ?? []) {
    const p = normalizePath(prefix);
    if (path === p || path.startsWith(`${p}/`)) return true;
  }

  return path === target || path.startsWith(`${target}/`);
}

/** Resolve which primary section owns the current path. */
export function resolveInternalPrimarySection(
  siteKey: SiteKey,
  pathname: string,
): InternalPrimarySectionId | null {
  const links = getInternalPrimaryNav(siteKey);
  const path = normalizePath(pathname);

  // Prefer longest / most specific active match (avoid Home stealing everything).
  let best: { id: InternalPrimarySectionId; score: number } | null = null;

  for (const link of links) {
    if (!isInternalNavActive(path, link)) continue;
    const id = primarySectionIdForLink(siteKey, link);
    if (!id) continue;
    const score = link.exact ? 1000 : Math.max(link.to.length, ...(link.matchPrefixes ?? []).map((p) => p.length));
    if (!best || score > best.score) best = { id, score };
  }

  return best?.id ?? null;
}

function primarySectionIdForLink(siteKey: SiteKey, link: InternalNavLink): InternalPrimarySectionId | null {
  const label = link.label.toLowerCase();
  if (label === "home") return "home";
  if (label === "inbox") return "inbox";
  if (label === "directory") return "directory";
  if (label === "customers") return "customers";
  if (label === "investors") return "investors";
  if (label === "portfolios") return "portfolios";
  if (label === "orders") return "orders";
  if (label === "money") return "money";
  if (label === "products") return "products";
  if (label === "system") return "system";
  if (label === "maintenance") return "maintenance";
  void siteKey;
  return null;
}

export function getInternalContextualNav(
  siteKey: SiteKey,
  pathname: string,
): InternalContextualNav | null {
  const section = resolveInternalPrimarySection(siteKey, pathname);
  if (!section) return null;

  if (section === "directory" || section === "customers") {
    return {
      sectionId: section,
      label: section === "customers" ? "Customers" : "Directory",
      links: [
        { label: "People", to: "/internal/users", match: "/internal/users" },
        { label: "Companies", to: "/internal/companies", match: "/internal/companies" },
        {
          label: "Relationships",
          to: "/internal/relationships",
          match: "/internal/relationships",
        },
      ],
    };
  }

  if (section === "money") {
    return {
      sectionId: "money",
      label: "Money",
      links: [
        { label: "Accounts", to: "/internal/bank/accounts", match: "/internal/bank/accounts" },
        { label: "Transactions", to: "/internal/bank/transactions", match: "/internal/bank/transactions" },
        { label: "Transfers", to: "/internal/bank/transfers", match: "/internal/bank/transfers" },
      ],
      overflow: {
        label: "Operations",
        links: [
          { label: "Alta Pay", to: "/internal/bank/alta-pay", match: "/internal/bank/alta-pay" },
          { label: "Statements", to: "/internal/bank/statements", match: "/internal/bank/statements" },
          { label: "Interest", to: "/internal/bank/interest", match: "/internal/bank/interest" },
        ],
      },
    };
  }

  if (section === "products") {
    if (pathname.startsWith("/internal/alta-card")) {
      return {
        sectionId: "products",
        label: "Alta Card",
        links: [
          { label: "Overview", to: "/internal/alta-card", match: "/internal/alta-card", exact: true },
          { label: "Cards", to: "/internal/alta-card/cards", match: "/internal/alta-card/cards" },
        ],
        overflow: {
          label: "Products",
          links: [{ label: "Lending", to: "/internal/lending", match: "/internal/lending" }],
        },
      };
    }
    return {
      sectionId: "products",
      label: "Lending",
      links: [
        { label: "Overview", to: "/internal/lending", match: "/internal/lending", exact: true },
        { label: "Loans", to: "/internal/lending/loans", match: "/internal/lending/loans" },
      ],
      overflow: {
        label: "Products",
        links: [{ label: "Alta Card", to: "/internal/alta-card", match: "/internal/alta-card" }],
      },
    };
  }

  if (section === "system") {
    if (siteKey === "terminal") {
      return {
        sectionId: "system",
        label: "System",
        links: [
          { label: "Overview", to: "/internal/terminal/system", match: "/internal/terminal/system", exact: true },
          { label: "Crypto markets", to: "/internal/terminal/crypto", match: "/internal/terminal/crypto" },
          { label: "Settings", to: "/internal/terminal/settings", match: "/internal/terminal/settings" },
        ],
      };
    }
    if (siteKey === "bank") {
      return {
        sectionId: "system",
        label: "System",
        links: [
          { label: "Jobs", to: "/internal/jobs", match: "/internal/jobs" },
          { label: "Audit", to: "/internal/audit", match: "/internal/audit" },
          { label: "Reports", to: "/internal/reports", match: "/internal/reports" },
        ],
        overflow: {
          label: "More",
          links: [
            { label: "Settings", to: "/internal/bank/settings", match: "/internal/bank/settings" },
          ],
        },
      };
    }
    return {
      sectionId: "system",
      label: "System",
      links: [
        { label: "Jobs", to: "/internal/jobs", match: "/internal/jobs" },
        { label: "Audit", to: "/internal/audit", match: "/internal/audit" },
        { label: "Reports", to: "/internal/reports", match: "/internal/reports" },
      ],
      overflow: {
        label: "More",
        links: [
          { label: "Settings", to: "/internal/settings", match: "/internal/settings" },
          { label: "Risk", to: "/internal/compliance", match: "/internal/compliance" },
          { label: "Communications", to: "/internal/embeds", match: "/internal/embeds" },
        ],
      },
    };
  }

  return null;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, "");
  return trimmed || "/";
}
