import type { LucideIcon } from "lucide-react";
import { Coins, Landmark, LineChart } from "lucide-react";

export type EntityStatus =
  | "Operational"
  | "In Development"
  | "Release Candidate"
  | "Planned";

export type PlatformStatusItem = {
  name: string;
  status: EntityStatus;
};

export const platformStatusItems: PlatformStatusItem[] = [
  { name: "Alta Bank N.V.", status: "Operational" },
  { name: "Alta Terminal", status: "In Development" },
  { name: "NCC", status: "Release Candidate" },
  { name: "Company Registry", status: "Operational" },
  { name: "Discord Authentication", status: "Operational" },
  { name: "Business Banking", status: "Operational" },
  { name: "Developer API", status: "Planned" },
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
    icon: LineChart,
    name: "Alta Terminal",
    status: "In Development",
    description:
      "Brokerage and trading platform under development — market data, execution, and custody await external exchange connectivity.",
  },
  {
    icon: Coins,
    name: "NCC",
    status: "Release Candidate",
    description:
      "Newport Clearing Corporation — cash settlement between participating banks and Alta Terminal. Release candidate undergoing final testing.",
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
    icon: LineChart,
    name: "Alta Terminal",
    code: "ALT-TRM",
    status: "In Development",
    description:
      "Alta’s brokerage and trading platform. Portfolio tools are available; trading, execution, market data, and custody are not live pending external exchange connectivity.",
    services: ["Portfolio dashboard", "Watchlists", "Research", "Brokerage accounts"],
  },
  {
    icon: Coins,
    name: "NCC",
    code: "NCC",
    status: "Release Candidate",
    description:
      "Newport Clearing Corporation — cash transfers between participating banks and Alta Terminal. Release candidate undergoing final testing; not a fully released production network. NCC settles cash, not securities trades.",
    services: ["Bank ↔ Terminal cash", "Institution routing", "Settlement accounts", "Participation network"],
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
        name: "Culls",
        status: "Appointed",
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
    sectionTitle: "Terminal Leadership",
    division: "Alta Terminal",
    roles: [
      {
        title: "President, Alta Terminal",
        name: "FTLCEO",
        minecraftUsername: "12700k",
        status: "Appointed",
        responsibility: "Brokerage operations, product direction, and investor platform governance.",
      },
      {
        title: "Head of Brokerage",
        status: "Vacant",
        responsibility: "Client coverage, account onboarding, and trading desk coordination.",
      },
      {
        title: "Market Operations Officer",
        status: "Vacant",
        responsibility: "Order routing readiness, market data feeds, and session operations.",
      },
    ],
  },
  {
    sectionTitle: "NCC Leadership",
    division: "NCC",
    roles: [
      {
        title: "President, NCC",
        name: "Musclebound",
        status: "Appointed",
        responsibility: "Clearing network planning and settlement infrastructure.",
      },
      {
        title: "Settlement Director",
        status: "Vacant",
        responsibility: "Cash settlement design and interbank settlement policy.",
      },
      {
        title: "Network Operations Officer",
        status: "Vacant",
        responsibility: "Payment rails, account registry, and network resilience.",
      },
    ],
  },
];
