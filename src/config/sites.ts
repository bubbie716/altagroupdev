import { EXCHANGE_PRIMARY_NAV_LINKS } from "@/lib/exchange/exchange-primary-nav";
import { TERMINAL_PRIMARY_NAV_LINKS } from "@/lib/terminal/terminal-primary-nav";

export type SiteKey = "corporate" | "bank" | "exchange" | "terminal" | "ncc";

export type SiteNavLink = {
  label: string;
  to: string;
  match?: string;
  exact?: boolean;
  external?: boolean;
  /** Additional path prefixes that should mark this link active. */
  activePaths?: string[];
};

export type SiteCategory = "corporate" | "banking" | "markets" | "terminal" | "infrastructure";

export type SiteSeo = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
};

/** Homepage login copy — each entity gets its own message. */
export type SiteLoginHome = {
  panelTitle: string;
  panelDescription: string;
  panelTags: string[];
  signInEyebrow: string;
  signInTitle: string;
  signInDescription: string;
  accessTitle: string;
  accessSubtitle: string;
  accessFooter: string;
};

export type SiteConfig = {
  key: SiteKey;
  category: SiteCategory;
  entityName: string;
  displayName: string;
  shortName: string;
  description: string;
  tagline: string;
  primaryRoute: "/";
  homeRoute: "/";
  dashboardRoute: string;
  defaultAuthenticatedRoute: string;
  loginEyebrow: string;
  loginHome: SiteLoginHome;
  /** Uppercase label shown inline in the header wordmark (e.g. GROUP, BANK). */
  wordmarkSuffix: string;
  navLinks: SiteNavLink[];
  ctaLabel?: string;
  ctaRoute?: string;
  seo: SiteSeo;
  /** Production hostnames (without port). */
  productionHosts: string[];
  /** Local dev subdomain label (e.g. bank.localhost). */
  localSubdomain?: string;
  accentClass?: string;
};

const CORPORATE_NAV: SiteNavLink[] = [
  { label: "Home", to: "/home", match: "/home" },
  { label: "Structure", to: "/structure", match: "/structure" },
  { label: "Leadership", to: "/leadership", match: "/leadership" },
  { label: "Legal", to: "/legal", match: "/legal" },
  { label: "Support", to: "/support", match: "/support" },
];

/** Static fallback; live bank header uses `buildBankPrimaryNavLinks` via `useBankPrimaryNavLinks`. */
const BANK_NAV: SiteNavLink[] = [
  { label: "Dashboard", to: "/bank", exact: true, match: "/bank", activePaths: ["/bank/account"] },
  { label: "Deposit", to: "/bank/deposit", match: "/bank/deposit" },
  { label: "Withdraw", to: "/bank/withdraw", match: "/bank/withdraw" },
  { label: "Transfers", to: "/bank/transfers", match: "/bank/transfers" },
  { label: "Alta Pay", to: "/bank/pay", match: "/bank/pay" },
  { label: "Alta Card", to: "/bank/alta-card", match: "/bank/alta-card" },
  { label: "Lending", to: "/bank/lending", match: "/bank/lending" },
  { label: "Products", to: "/bank/products", match: "/bank/products", activePaths: ["/bank/deposits"] },
  { label: "Statements", to: "/bank/statements", match: "/bank/statements" },
  { label: "Settings", to: "/bank/settings", match: "/bank/settings" },
];

const EXCHANGE_NAV: SiteNavLink[] = EXCHANGE_PRIMARY_NAV_LINKS;

const TERMINAL_NAV: SiteNavLink[] = TERMINAL_PRIMARY_NAV_LINKS;

const NCC_NAV: SiteNavLink[] = [
  { label: "Home", to: "/", exact: true },
  { label: "Institutions", to: "/institutions", match: "/institutions" },
  { label: "Participation", to: "/participation", match: "/participation" },
  { label: "Network", to: "/network", match: "/network" },
  { label: "Legal", to: "/legal", match: "/legal" },
  { label: "Support", to: "/support", match: "/support" },
];

export const SITE_CONFIGS: Record<SiteKey, SiteConfig> = {
  corporate: {
    key: "corporate",
    category: "corporate",
    entityName: "Alta Group N.V.",
    displayName: "Alta Group",
    shortName: "Alta",
    description: "Financial infrastructure for Newport.",
    tagline: "Live Like the 1%",
    primaryRoute: "/",
    homeRoute: "/home",
    dashboardRoute: "/home",
    defaultAuthenticatedRoute: "/home",
    loginEyebrow: "Alta Group · Log-in",
    loginHome: {
      panelTitle: "The financial infrastructure of Newport.",
      panelDescription:
        "Alta Bank, Alta Exchange, Alta Terminal, and Newport Clearing Corporation — one integrated platform for individuals, businesses, and institutions.",
      panelTags: ["Banking", "Capital Markets", "Financial Infrastructure"],
      signInEyebrow: "Member sign-in",
      signInTitle: "Sign in to Alta Group",
      signInDescription:
        "Sign in with Discord to access the Alta Group platform, subsidiaries, and your account.",
      accessTitle: "Alta Platform Access",
      accessSubtitle: "Single sign-on · Discord OAuth",
      accessFooter: "Individual accounts · Authorized company representatives",
    },
    wordmarkSuffix: "GROUP",
    navLinks: CORPORATE_NAV,
    seo: {
      title: "Alta Group",
      description: "Financial infrastructure for Newport.",
      ogTitle: "Alta Group",
      ogDescription: "The holding company behind Alta Bank, Alta Exchange, Alta Terminal, and NCC.",
    },
    productionHosts: ["altagroup.dev", "www.altagroup.dev"],
  },
  bank: {
    key: "bank",
    category: "banking",
    entityName: "Alta Bank N.V.",
    displayName: "Alta Bank",
    shortName: "Bank",
    description: "Banking, payments, and commercial financial services for Newport.",
    tagline: "Banking built for Newport",
    primaryRoute: "/",
    homeRoute: "/",
    dashboardRoute: "/bank",
    defaultAuthenticatedRoute: "/bank",
    loginEyebrow: "Alta Bank · Log-in",
    loginHome: {
      panelTitle: "Banking, payments, and commercial finance for Newport.",
      panelDescription:
        "Open accounts, move money with Alta Pay, manage business treasury, issue Alta Card, and run commercial billing — one platform for individuals and companies.",
      panelTags: ["Personal", "Business", "Commercial"],
      signInEyebrow: "Member sign-in",
      signInTitle: "Sign in to Alta Bank",
      signInDescription:
        "Access your accounts, Alta Pay, Alta Card, and commercial banking tools with your Discord account.",
      accessTitle: "Alta Bank Access",
      accessSubtitle: "Single sign-on · Discord OAuth",
      accessFooter: "Individual accounts · Business representatives",
    },
    wordmarkSuffix: "BANK",
    navLinks: BANK_NAV,
    seo: {
      title: "Alta Bank",
      description: "Banking, payments, and commercial financial services for Newport.",
      ogTitle: "Alta Bank",
      ogDescription: "Accounts, Alta Pay, Alta Card, and commercial banking for Newport.",
    },
    productionHosts: ["bank.altagroup.dev"],
    localSubdomain: "bank",
    accentClass: "text-gold",
  },
  exchange: {
    key: "exchange",
    category: "markets",
    entityName: "Alta Exchange N.V.",
    displayName: "Alta Exchange",
    shortName: "Exchange",
    description: "Listings, IPOs, and market infrastructure for Newport.",
    tagline: "The capital markets platform of Newport",
    primaryRoute: "/",
    homeRoute: "/",
    dashboardRoute: "/exchange",
    defaultAuthenticatedRoute: "/exchange",
    loginEyebrow: "Alta Exchange · Log-in",
    loginHome: {
      panelTitle: "Listings, IPOs, and market infrastructure for Newport.",
      panelDescription:
        "Alta Exchange operates Newport's primary market for listings, price discovery, corporate actions, issuer services, and market data.",
      panelTags: ["Listings", "IPOs", "Market Data"],
      signInEyebrow: "Member sign-in",
      signInTitle: "Sign in to Alta Exchange",
      signInDescription:
        "Access listings, IPOs, issuer tools, and market data with your Discord account.",
      accessTitle: "Alta Exchange Access",
      accessSubtitle: "Single sign-on · Discord OAuth",
      accessFooter: "Issuers · Investors · Market participants",
    },
    wordmarkSuffix: "EXCHANGE",
    navLinks: EXCHANGE_NAV,
    seo: {
      title: "Alta Exchange",
      description: "Listings, IPOs, and market infrastructure for Newport.",
      ogTitle: "Alta Exchange",
      ogDescription: "Listings, IPOs, market data, and issuer services for Newport.",
    },
    productionHosts: ["exchange.altagroup.dev"],
    localSubdomain: "exchange",
  },
  terminal: {
    key: "terminal",
    category: "terminal",
    entityName: "Alta Terminal",
    displayName: "Alta Terminal",
    shortName: "Terminal",
    description: "Trading, portfolio, and market access by Alta Exchange.",
    tagline: "Invest Like the 1%",
    primaryRoute: "/",
    homeRoute: "/",
    dashboardRoute: "/terminal",
    defaultAuthenticatedRoute: "/terminal",
    loginEyebrow: "Alta Terminal · Log-in",
    loginHome: {
      panelTitle: "Trading, portfolio, and market access for Newport investors.",
      panelDescription:
        "Portfolio analytics, watchlists, order entry, IPO access, and market research — one workspace built on Alta Exchange.",
      panelTags: ["Portfolio", "Trading", "Research"],
      signInEyebrow: "Member sign-in",
      signInTitle: "Sign in to Alta Terminal",
      signInDescription:
        "Access your portfolio, trading tools, watchlists, and market research with your Discord account.",
      accessTitle: "Alta Terminal Access",
      accessSubtitle: "Single sign-on · Discord OAuth",
      accessFooter: "Portfolio · Trading · Market access",
    },
    wordmarkSuffix: "TERMINAL",
    navLinks: TERMINAL_NAV,
    seo: {
      title: "Alta Terminal",
      description: "Trading, portfolio, and market access by Alta Exchange.",
      ogTitle: "Alta Terminal",
      ogDescription: "Portfolio, trading, watchlists, and market access for Newport investors.",
    },
    productionHosts: ["terminal.altagroup.dev"],
    localSubdomain: "terminal",
  },
  ncc: {
    key: "ncc",
    category: "infrastructure",
    entityName: "Newport Clearing Corporation",
    displayName: "NCC",
    shortName: "NCC",
    description: "Clearing, settlement, and routing infrastructure for approved institutions.",
    tagline: "Clearing infrastructure for Newport",
    primaryRoute: "/",
    homeRoute: "/",
    dashboardRoute: "/portal",
    defaultAuthenticatedRoute: "/portal",
    loginEyebrow: "NCC · Log-in",
    loginHome: {
      panelTitle: "Clearing, settlement, and routing for approved institutions.",
      panelDescription:
        "NCC provides institution connectivity, participation standards, and operating rules for clearing and settlement across the Alta ecosystem.",
      panelTags: ["Clearing", "Settlement", "Institutions"],
      signInEyebrow: "Institution sign-in",
      signInTitle: "Sign in to NCC",
      signInDescription:
        "Approved institution representatives can access clearing, settlement, and network tools with your Discord account.",
      accessTitle: "Institution Access",
      accessSubtitle: "Single sign-on · Discord OAuth",
      accessFooter: "Approved institutions · Authorized representatives",
    },
    wordmarkSuffix: "NCC",
    navLinks: NCC_NAV,
    ctaLabel: "Apply for Participation",
    ctaRoute: "/participation",
    seo: {
      title: "Newport Clearing Corporation",
      description: "Clearing, settlement, and routing infrastructure for approved institutions.",
      ogTitle: "Newport Clearing Corporation",
      ogDescription: "Institution clearing, settlement, and participation infrastructure.",
    },
    productionHosts: [
      "newportclearingcorporation.com",
      "www.newportclearingcorporation.com",
      "ncc.altagroup.dev",
    ],
    localSubdomain: "ncc",
  },
};

export const SITE_KEYS = Object.keys(SITE_CONFIGS) as SiteKey[];

export function isSiteKey(value: string): value is SiteKey {
  return (SITE_KEYS as string[]).includes(value);
}

export function getSiteConfig(key: SiteKey): SiteConfig {
  return SITE_CONFIGS[key];
}

export function getDefaultSiteConfig(): SiteConfig {
  return SITE_CONFIGS.corporate;
}
