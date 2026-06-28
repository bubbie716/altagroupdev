import fs from "node:fs/promises";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";
import type { E2eManifest } from "./test-users.js";
import { E2E_MANIFEST_PATH } from "./test-users.js";

const ALLOWED_CONSOLE_PATTERNS = [
  /Download the React DevTools/,
  /TanStack Start server functions are not protected by the CSRF middleware/,
  /createServerFn\(\)\.inputValidator\(\) is deprecated/,
  /\[vite\]/,
  /Failed to load resource.*favicon/,
];

const ALLOWED_NETWORK_PATTERNS = [
  /favicon\.ico/,
  /_vite/,
  /hot-update/,
  /\.map$/,
];

export type PageHealthTracker = {
  attach: (page: Page) => void;
  assertClean: () => void;
  getErrors: () => { console: string[]; network: string[] };
};

export function createPageHealthTracker(): PageHealthTracker {
  const consoleErrors: string[] = [];
  const networkFailures: string[] = [];
  let attached = false;

  return {
    attach(page: Page) {
      if (attached) return;
      attached = true;

      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (ALLOWED_CONSOLE_PATTERNS.some((p) => p.test(text))) return;
        consoleErrors.push(text);
      });

      page.on("pageerror", (error) => {
        consoleErrors.push(error.message);
      });

      page.on("response", (response) => {
        const status = response.status();
        if (status < 400) return;
        const url = response.url();
        if (ALLOWED_NETWORK_PATTERNS.some((p) => p.test(url))) return;
        if (url.includes("/api/") || url.includes("/bank/") || url.includes("/internal/")) {
          networkFailures.push(`${status} ${url}`);
        }
      });
    },
    assertClean() {
      const all = [...consoleErrors, ...networkFailures];
      if (all.length > 0) {
        throw new Error(`Page health check failed:\n${all.join("\n")}`);
      }
    },
    getErrors() {
      return { console: [...consoleErrors], network: [...networkFailures] };
    },
  };
}

export async function visitAndAssert(
  page: Page,
  url: string,
  options: {
    titlePattern?: RegExp;
    heading?: RegExp | string;
    testInfo?: TestInfo;
  } = {},
): Promise<void> {
  const health = createPageHealthTracker();
  health.attach(page);

  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  if (response && response.status() >= 400) {
    throw new Error(`Route ${url} returned HTTP ${response.status()}`);
  }

  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

  if (options.titlePattern) {
    await page.waitForFunction(
      (pattern) => new RegExp(pattern).test(document.title),
      options.titlePattern.source,
      { timeout: 10_000 },
    ).catch(() => undefined);
  }

  if (options.heading) {
    const pattern =
      typeof options.heading === "string" ? new RegExp(options.heading, "i") : options.heading;
    const heading = page.getByRole("heading", { level: 1 }).or(page.getByRole("heading", { level: 2 }));
    await heading.filter({ hasText: pattern }).first().waitFor({ timeout: 10_000 }).catch(() => undefined);
  }

  const bodyText = await page.locator("body").innerText();
  if (/internal server error|something went wrong|application error/i.test(bodyText)) {
    throw new Error(`Error screen detected on ${url}`);
  }

  health.assertClean();
}

export async function loadE2eManifest(): Promise<E2eManifest> {
  const raw = await fs.readFile(path.resolve(E2E_MANIFEST_PATH), "utf8");
  return JSON.parse(raw) as E2eManifest;
}

export async function screenshotPage(page: Page, name: string): Promise<void> {
  await fs.mkdir("tests/e2e/reports/screenshots", { recursive: true });
  await page.screenshot({
    path: `tests/e2e/reports/screenshots/${name}.png`,
    fullPage: true,
  });
}
