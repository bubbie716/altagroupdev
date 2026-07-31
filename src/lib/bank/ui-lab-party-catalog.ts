/**
 * Authoritative UI Lab party catalog — people and companies exposed by Alta Pay,
 * commercial fixtures, related-record links, and customer/company workspaces.
 * Single source of truth; do not invent disconnected duplicates per route.
 */
import type { InternalUserDetail } from "@/lib/internal/user-management.types";
import {
  UI_LAB_CORE_COMPANY_ID,
  UI_LAB_HARBOR_COMPANY_ID,
  UI_LAB_PRO_COMPANY_ID,
} from "@/lib/bank/ui-lab-commercial-fixtures";

export type UiLabPartyKind = "person" | "company";

export type UiLabPartyRecord = {
  kind: UiLabPartyKind;
  id: string;
  /** Operator-facing display name */
  name: string;
  /** @handle or ticker/subtitle */
  subtitle: string;
  /** When false, related UI must render non-clickable text (no workspace). */
  hasInternalRecord: boolean;
  /** Linked personal/operating account id when present in the account catalog */
  primaryAccountId: string | null;
  accountNumber: string | null;
};

/** Align Harbor company with seed CO-HBR while preserving CO-HARBOR aliases. */
export const UI_LAB_HARBOR_COMPANY_CANONICAL_ID = "CO-HBR";

export function canonicalizeUiLabPartyId(id: string): string {
  if (id === "CO-HARBOR" || id === UI_LAB_HARBOR_COMPANY_ID) {
    return UI_LAB_HARBOR_COMPANY_CANONICAL_ID;
  }
  return id;
}

export const UI_LAB_PARTY_CATALOG: UiLabPartyRecord[] = [
  {
    kind: "person",
    id: "ui-lab-user",
    name: "Carter Townshend",
    subtitle: "@carter",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-CHK",
    accountNumber: "AB-2000-100002",
  },
  {
    kind: "person",
    id: "ui-lab-person-ava",
    name: "Ava Chen",
    subtitle: "@ava",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-AVA",
    accountNumber: "AB-5000-100001",
  },
  {
    kind: "person",
    id: "ui-lab-person-noah",
    name: "Noah Patel",
    subtitle: "@noah",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-NOAH",
    accountNumber: "AB-5000-100002",
  },
  {
    kind: "person",
    id: "ui-lab-person-harbor",
    name: "Harbor Line",
    subtitle: "@HarborLine",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-HARBOR-P",
    accountNumber: "AB-5000-100089",
  },
  {
    kind: "person",
    id: "ui-lab-person-riley",
    name: "Riley Quinn",
    subtitle: "@riley",
    /** Intentionally no internal bank record — links must stay non-clickable. */
    hasInternalRecord: false,
    primaryAccountId: null,
    accountNumber: null,
  },
  {
    kind: "company",
    id: UI_LAB_CORE_COMPANY_ID,
    name: "Alta Group N.V.",
    subtitle: "ALTG",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-ALTG-OP",
    accountNumber: "AB-5000-100020",
  },
  {
    kind: "company",
    id: UI_LAB_PRO_COMPANY_ID,
    name: "Newport Petroleum Corp.",
    subtitle: "NPC",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-NPC-OP",
    accountNumber: "AB-5000-100010",
  },
  {
    kind: "company",
    id: UI_LAB_HARBOR_COMPANY_CANONICAL_ID,
    name: "Harbor Logistics Ltd.",
    subtitle: "HBR",
    hasInternalRecord: true,
    primaryAccountId: "BA-LAB-HARBOR-B",
    accountNumber: "AB-3500-200089",
  },
];

export function getUiLabParty(id: string): UiLabPartyRecord | null {
  const canonical = canonicalizeUiLabPartyId(id);
  return UI_LAB_PARTY_CATALOG.find((p) => p.id === canonical) ?? null;
}

export function uiLabPartyHasResolvableWorkspace(id: string): boolean {
  const party = getUiLabParty(id);
  return Boolean(party?.hasInternalRecord);
}

function emptyCapabilities(): InternalUserDetail["capabilities"] {
  const denied = { canGrant: false, canRevoke: false, requiresConfirm: true, danger: true };
  return {
    tags: {
      corporate_admin: denied,
      bank_admin: denied,
      terminal_admin: denied,
    },
    allowedAccountStatuses: ["active", "restricted", "frozen", "pending_review"],
    canChangeAccountStatus: false,
  };
}

/** Customer 360 fixture for resolvable UI Lab people — never hits Prisma. */
export function getUiLabCustomer360(userId: string): {
  user: InternalUserDetail;
  notes: [];
  timeline: [];
  altaPayActivity: [];
} | null {
  const party = getUiLabParty(userId);
  if (!party || party.kind !== "person" || !party.hasInternalRecord) return null;

  const accounts =
    party.primaryAccountId && party.accountNumber
      ? [
          {
            id: party.primaryAccountId,
            accountName: `${party.name} · Personal`,
            accountNumber: party.accountNumber,
            accountTypeLabel: "Personal",
            statusLabel: "Active",
            balance: party.id === "ui-lab-user" ? 38_214.2 : 4_250,
            currency: "FLD",
            isCompanyAccount: false,
            companyName: null,
          },
        ]
      : [];

  const username = party.subtitle.replace(/^@/, "") || party.name;
  const user: InternalUserDetail = {
    id: party.id,
    discordUsername: username,
    discordId: `ui-lab-${party.id}`,
    email: `${username}@ui-lab.local`,
    minecraftUsername: username,
    accountStatus: "active",
    tags: [],
    companyCount: party.id === "ui-lab-person-harbor" ? 1 : 0,
    bankAccountCount: accounts.length,
    altaCardCount: 0,
    activeLoanCount: 0,
    terminalPortfolioCount: 0,
    totalBankBalance: accounts.reduce((s, a) => s + a.balance, 0),
    lastLoginAt: "2026-07-20T12:00:00.000Z",
    createdAt: "2025-06-01T00:00:00.000Z",
    avatarUrl: null,
    companyMemberships:
      party.id === "ui-lab-person-harbor"
        ? [
            {
              companyId: UI_LAB_HARBOR_COMPANY_CANONICAL_ID,
              companyName: "Harbor Logistics Ltd.",
              role: "executive",
              roleLabel: "Executive",
            },
          ]
        : [],
    bankAccounts: accounts,
    recentTransactions: [],
    loanApplications: [],
    activeLoans: [],
    recentAuditLogs: [],
    capabilities: emptyCapabilities(),
  };

  return { user, notes: [], timeline: [], altaPayActivity: [] };
}

export function listUiLabResolvablePartyIds(): string[] {
  return UI_LAB_PARTY_CATALOG.filter((p) => p.hasInternalRecord).map((p) => p.id);
}

/** Company 360 fixture for resolvable UI Lab companies — never hits Prisma. */
export function getUiLabCompany360(
  companyId: string,
  options?: { includeTimeline?: boolean },
): {
  company: {
    id: string;
    name: string;
    ticker: string | null;
    type: string;
    sector: string | null;
    status: string;
    verificationStatus: string;
    createdAt: string;
    updatedAt: string;
    members: Array<{
      membershipId: string;
      userId: string;
      discordUsername: string;
      minecraftUsername: string | null;
      role: string;
      roleLabel: string;
      joinedAt: string;
    }>;
  };
  notes: [];
  timeline: [];
  relationshipManager: null;
  verificationTimeline: Array<{ label: string; at: string }>;
  bankAccounts: Array<{
    id: string;
    accountNumber: string;
    accountName: string;
    accountTypeLabel: string;
    status: string;
    balance: number;
  }>;
  loans: Array<{
    id: string;
    status: string;
    principalAmount: number;
    outstandingBalance: number;
    createdAt: string;
  }>;
  altaPayActivity: [];
  statements: [];
  commercialPlan: {
    commercialPlan: string;
    grantSource: null;
    expiresAt: null;
    billingStatus: string;
  };
} | null {
  void options;
  const party = getUiLabParty(companyId);
  if (!party || party.kind !== "company" || !party.hasInternalRecord) return null;

  const createdAt = "2025-06-01T00:00:00.000Z";
  const updatedAt = "2026-07-20T12:00:00.000Z";
  const isPro = party.id === UI_LAB_PRO_COMPANY_ID;

  return {
    company: {
      id: party.id,
      name: party.name,
      ticker: party.subtitle,
      type: "Corporation",
      sector: "Finance",
      status: "Active",
      verificationStatus: "Verified",
      createdAt,
      updatedAt,
      members: [
        {
          membershipId: `mem-${party.id}`,
          userId: "ui-lab-user",
          discordUsername: "carter",
          minecraftUsername: "carter",
          role: "owner",
          roleLabel: "Owner",
          joinedAt: createdAt,
        },
      ],
    },
    notes: [],
    timeline: [],
    relationshipManager: null,
    verificationTimeline: [
      { label: "Registered", at: createdAt },
      { label: "Verification: Verified", at: updatedAt },
    ],
    bankAccounts:
      party.primaryAccountId && party.accountNumber
        ? [
            {
              id: party.primaryAccountId,
              accountNumber: party.accountNumber,
              accountName: `${party.name} · Operating`,
              accountTypeLabel: "Operating",
              status: "ACTIVE",
              balance: isPro ? 2_480_300.55 : 840_220.1,
            },
          ]
        : [],
    loans:
      party.id === UI_LAB_CORE_COMPANY_ID
        ? [
            {
              id: "LN-LAB-COMPANY",
              status: "ACTIVE",
              principalAmount: 150_000,
              outstandingBalance: 113_250,
              createdAt: "2026-01-15T00:00:00.000Z",
            },
          ]
        : [],
    altaPayActivity: [],
    statements: [],
    commercialPlan: {
      commercialPlan: isPro ? "PRO" : "CORE",
      grantSource: null,
      expiresAt: null,
      billingStatus: isPro ? "CURRENT" : "NOT_BILLED",
    },
  };
}
