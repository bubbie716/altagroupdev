import type { LucideIcon } from "lucide-react";
import { Building2, Coins, Landmark, LineChart } from "lucide-react";
import {
  ALTA_EXCHANGE_TAGLINE,
  ALTA_TERMINAL_TAGLINE,
} from "@/lib/branding/alta-products";

export type EntityStatus = "Operational" | "Exchange Product" | "In Development" | "Planned";

export type PlatformStatusItem = {
  name: string;
  status: EntityStatus;
};

export const platformStatusItems: PlatformStatusItem[] = [
  { name: "Alta Bank N.V.", status: "Operational" },
  { name: "Alta Exchange N.V.", status: "Operational" },
  { name: "Alta Terminal", status: "Exchange Product" },
  { name: "NCC", status: "In Development" },
  { name: "Company Registry", status: "Operational" },
  { name: "Discord Authentication", status: "Operational" },
  { name: "Business Banking", status: "Operational" },
  { name: "Developer API", status: "Planned" },
  { name: "Settlement Network", status: "Planned" },
];

/** Compact hierarchy node — ownership/reporting only. */
export type HierarchyNode = {
  icon: LucideIcon;
  name: string;
  status: EntityStatus;
  description: string;
  children?: HierarchyNode[];
};

export const groupHierarchy: HierarchyNode[] = [
  {
    icon: Landmark,
    name: "Alta Bank N.V.",
    status: "Operational",
    description: "Banking division of Alta Group N.V.",
  },
  {
    icon: Building2,
    name: "Alta Exchange N.V.",
    status: "Operational",
    description: "National market venue and capital markets platform.",
    children: [
      {
        icon: LineChart,
        name: "Alta Terminal",
        status: "Exchange Product",
        description: "Investor workstation — an Alta Exchange product.",
      },
    ],
  },
  {
    icon: Coins,
    name: "NCC",
    status: "Planned",
    description: "Newport Clearing Corporation — settlement infrastructure.",
  },
];

export type EntityProduct = {
  name: string;
  subtitle: string;
  tagline: string;
  services: string[];
};

/** Detailed entity cards for Entity Overview section. */
export type EntityOverviewItem = {
  icon: LucideIcon;
  name: string;
  code: string;
  status: EntityStatus;
  description: string;
  services: string[];
  products?: EntityProduct[];
};

export const entityOverviewItems: EntityOverviewItem[] = [
  {
    icon: Landmark,
    name: "Alta Bank N.V.",
    code: "ALT-BNK",
    status: "Operational",
    description:
      "Full-service banking for Newport — personal accounts, business treasury, lending, and Alta Private invitation tiers.",
    services: ["Deposits", "Business Banking", "Lending", "Treasury Services", "Alta Pay"],
  },
  {
    icon: Building2,
    name: "Alta Exchange N.V.",
    code: "ALT-EXC",
    status: "Operational",
    description: ALTA_EXCHANGE_TAGLINE,
    services: ["Listings", "IPO Center", "Market Data", "Developer API", "Issuer Portal"],
    products: [
      {
        name: "Alta Terminal",
        subtitle: "Alta Exchange",
        tagline: ALTA_TERMINAL_TAGLINE,
        services: ["Portfolio dashboard", "Watchlists", "Research", "Order entry"],
      },
    ],
  },
  {
    icon: Coins,
    name: "NCC",
    code: "NCC",
    status: "Planned",
    description:
      "Newport Clearing Corporation — planned clearing and settlement infrastructure for securities and interbank payment flows.",
    services: ["Interbank Settlement", "Securities Clearing", "Account Registry", "Payment Network"],
  },
];

export type LeadershipCard = {
  title: string;
  name?: string;
  minecraftUsername?: string;
  status: "Appointed" | "Vacant";
  responsibility: string;
};

export const boardOfDirectors: LeadershipCard[] = [
  {
    title: "Chairman",
    name: "FTLCEO",
    minecraftUsername: "12700k",
    status: "Appointed",
    responsibility: "Board leadership, shareholder representation, and long-range corporate direction.",
  },
  {
    title: "Board Member",
    status: "Vacant",
    responsibility: "Oversight of group strategy, risk appetite, and divisional performance.",
  },
  {
    title: "Board Member",
    status: "Vacant",
    responsibility: "Audit, compliance, and governance standards across Alta Group entities.",
  },
];

export const executiveLeadership: LeadershipCard[] = [
  {
    title: "Chief Executive Officer",
    name: "FTLCEO",
    minecraftUsername: "12700k",
    status: "Appointed",
    responsibility: "Group-wide strategy, executive leadership, and divisional coordination.",
  },
  {
    title: "Chief Operating Officer",
    status: "Vacant",
    responsibility: "Operating standards, service delivery, and cross-division execution.",
  },
  {
    title: "Chief Financial Officer",
    status: "Vacant",
    responsibility: "Financial planning, treasury oversight, and institutional reporting.",
  },
  {
    title: "Chief Technology Officer",
    status: "Vacant",
    responsibility: "Platform engineering, market technology, and digital infrastructure.",
  },
  {
    title: "Chief Legal Officer",
    status: "Vacant",
    responsibility: "Corporate governance, regulatory affairs, and issuer compliance.",
  },
];

export type DivisionLeadershipGroup = {
  /** Section heading — omit legal entity suffix (N.V.) when shown above role cards. */
  sectionTitle: string;
  division: string;
  roles: LeadershipCard[];
};

export const divisionLeadership: DivisionLeadershipGroup[] = [
  {
    sectionTitle: "Bank Leadership",
    division: "Alta Bank N.V.",
    roles: [
      {
        title: "President, Alta Bank N.V.",
        status: "Vacant",
        responsibility: "Banking operations, client coverage, and treasury services.",
      },
      {
        title: "Private Banking Director",
        status: "Vacant",
        responsibility: "Private client relationships, wealth accounts, and advisory coverage.",
      },
      {
        title: "Relationship Manager",
        status: "Vacant",
        responsibility: "Day-to-day client service and account stewardship.",
      },
    ],
  },
  {
    sectionTitle: "Exchange Leadership",
    division: "Alta Exchange N.V.",
    roles: [
      {
        title: "President, Alta Exchange N.V.",
        status: "Vacant",
        responsibility: "Market venue operations, listings policy, and exchange governance.",
      },
      {
        title: "Listing Director",
        status: "Vacant",
        responsibility: "Issuer onboarding, listing standards, and corporate actions.",
      },
      {
        title: "Issuer Relations Officer",
        status: "Vacant",
        responsibility: "Listed company communications and IPO coordination.",
      },
      {
        title: "Market Operations Officer",
        status: "Vacant",
        responsibility: "Session management, market data, and surveillance readiness.",
      },
      {
        title: "Developer Relations",
        status: "Vacant",
        responsibility: "API access, integration partners, and market data licensing.",
      },
    ],
  },
  {
    sectionTitle: "NCC Leadership",
    division: "NCC",
    roles: [
      {
        title: "President, NCC",
        status: "Vacant",
        responsibility: "Clearing network planning and settlement infrastructure.",
      },
      {
        title: "Settlement Director",
        status: "Vacant",
        responsibility: "Securities clearing design and interbank settlement policy.",
      },
      {
        title: "Network Operations Officer",
        status: "Vacant",
        responsibility: "Payment rails, account registry, and network resilience.",
      },
    ],
  },
];
