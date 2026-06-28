/** Fixed Discord IDs for E2E users — never use real production accounts. */
export const E2E_DISCORD_IDS = {
  customer: "0000000000000e001",
  businessOwner: "0000000000000e002",
  financeManager: "0000000000000e003",
  operator: "0000000000000e004",
  admin: "0000000000000e005",
} as const;

export type E2eRole = keyof typeof E2E_DISCORD_IDS;

export type E2eManifest = {
  seededAt: string;
  users: Record<E2eRole, { id: string; discordId: string; username: string }>;
  accounts: {
    customerCheckingId: string;
    customerCheckingNumber: string;
    customerSavingsId: string;
    businessOperatingId: string | null;
  };
  companies: {
    harborId: string;
    npcId: string;
  };
  pending: {
    depositTransactionId: string | null;
    withdrawalTransactionId: string | null;
  };
};

export const E2E_MANIFEST_PATH = "tests/e2e/.auth/manifest.json";

export const SESSION_COOKIE_NAME = "alta_session";
