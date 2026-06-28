import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnv(): void {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const authDir = path.join(__dirname, "tests/e2e/.auth");
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: path.join(__dirname, "tests/e2e"),
  testMatch: ["**/*.spec.ts"],
  testIgnore: ["**/scripts/**", "**/utils/**", "**/reporters/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  projects: [
    {
      name: "customer",
      testMatch: /customer\/(?!business\.spec).*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      use: { ...devices["Desktop Chrome"], storageState: path.join(authDir, "customer.json") },
    },
    {
      name: "business",
      testMatch: /customer\/business\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: path.join(authDir, "business-owner.json") },
    },
    {
      name: "internal-operator",
      testMatch: /internal\/(queues|workspaces|deposits|withdrawals|settings-operator)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: path.join(authDir, "operator.json") },
    },
    {
      name: "internal-admin",
      testMatch: /internal\/.*\.spec\.ts/,
      testIgnore: /settings-operator\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: path.join(authDir, "admin.json") },
    },
    {
      name: "responsive",
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: path.join(authDir, "customer.json") },
    },
    {
      name: "visual",
      testMatch: /visual\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: path.join(authDir, "admin.json") },
    },
  ],
  outputDir: "test-results",
});
