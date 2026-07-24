import type { AccountStatus, CompanyMembership, UserTag } from "@/lib/auth/types";

/**
 * TEMPORARY — dev/staging overrides by Discord ID.
 *
 * Backend tags for real users live in Postgres (`UserTagAssignment`).
 * Use `npm run db:grant-tag -- <discordId> corporate_admin` after first login.
 * This file applies dev-only overrides for fake Discord IDs.
 */
export interface MockUserOverride {
  tags?: UserTag[];
  accountStatus?: AccountStatus;
  minecraftUsername?: string;
  developerAccess?: boolean;
  companyMemberships?: Omit<CompanyMembership, "userId">[];
}

export const MOCK_USER_OVERRIDES: Record<string, MockUserOverride> = {
  /** Demo overrides for local testing (memberships, tags, statuses). */
  "000000000000000001": {
    tags: ["corporate_admin", "private_client"],
    minecraftUsername: "VaultSeeker",
    developerAccess: true,
    companyMemberships: [{ companyId: "CO-NPC", role: "finance_manager" }],
  },
  "000000000000000002": {
    tags: ["private_client"],
    minecraftUsername: "HarborLine",
    companyMemberships: [
      { companyId: "CO-PRTH", role: "executive" },
      { companyId: "CO-HBR", role: "owner" },
    ],
  },
  "000000000000000003": {
    tags: [],
    minecraftUsername: "TerminalDev",
    developerAccess: true,
    companyMemberships: [{ companyId: "CO-ALTB", role: "compliance_contact" }],
  },
  "000000000000000004": {
    tags: [],
    minecraftUsername: "HelixFounder",
    companyMemberships: [{ companyId: "CO-HLXD", role: "owner" }],
  },
  "000000000000000005": {
    tags: ["private_client"],
    minecraftUsername: "MeridianCEO",
    companyMemberships: [{ companyId: "CO-PRTH", role: "owner" }],
  },
};

export function getMockUserOverride(discordId: string): MockUserOverride | undefined {
  return MOCK_USER_OVERRIDES[discordId];
}
