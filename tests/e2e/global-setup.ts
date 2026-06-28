import fs from "node:fs/promises";
import path from "node:path";
import type { FullConfig } from "@playwright/test";
import { seedE2eData, createSessionForUser } from "./scripts/seed-e2e-data.js";
import { assertSafeTestEnvironment, getBaseUrl } from "./utils/env.js";
import { E2E_DISCORD_IDS, SESSION_COOKIE_NAME, type E2eRole } from "./utils/test-users.js";

const AUTH_DIR = path.resolve("tests/e2e/.auth");

const ROLE_FILES: Record<E2eRole, string> = {
  customer: "customer.json",
  businessOwner: "business-owner.json",
  financeManager: "finance-manager.json",
  operator: "operator.json",
  admin: "admin.json",
};

async function writeStorageStateFile(role: E2eRole, userId: string, baseURL: string): Promise<void> {
  const token = await createSessionForUser(userId);
  const url = new URL(baseURL);
  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  const state = {
    cookies: [
      {
        name: SESSION_COOKIE_NAME,
        value: token,
        domain: url.hostname,
        path: "/",
        expires,
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  const file = path.join(AUTH_DIR, ROLE_FILES[role]);
  await fs.writeFile(file, JSON.stringify(state, null, 2));
  console.log(`[e2e] Auth state: ${file} (${role})`);
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  assertSafeTestEnvironment();
  await fs.mkdir(AUTH_DIR, { recursive: true });

  const manifest = await seedE2eData();
  const baseURL = getBaseUrl();

  const rolesToAuth: E2eRole[] = ["customer", "businessOwner", "operator", "admin"];
  for (const role of rolesToAuth) {
    await writeStorageStateFile(role, manifest.users[role].id, baseURL);
  }

  console.log("[e2e] Global setup complete.");
  console.log(`[e2e] Discord IDs: ${Object.values(E2E_DISCORD_IDS).join(", ")}`);
}
