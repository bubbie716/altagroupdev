/**
 * UI Lab commercial reliability walkthrough (desktop + mobile viewports).
 * Requires: VITE_UI_LAB_MODE=true on http://127.0.0.1:3000
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const CORE_ACCOUNT = "ui-lab-biz-core";
const PRO_ACCOUNT = "ui-lab-biz-pro";
const QUICK_LABELS = [
  "Payments",
  "Invoices",
  "Payment links",
  "Payroll",
  "Analytics",
  "Team",
  "Commercial settings",
];

function fail(msg) {
  console.log(`FAIL ${msg}`);
  return 1;
}

async function waitForServer(page, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await page.goto(`${BASE}/bank/business?site=bank`, {
        waitUntil: "domcontentloaded",
        timeout: 5000,
      });
      if (res && res.status() < 500) return;
    } catch {
      // retry
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("Dev server not reachable on :3000");
}

async function assertHub(page, companyId, accountId, label) {
  process.stdout.write(`… hub-quick-links-${label} `);
  await page.goto(`${BASE}/bank/business?site=bank&companyId=${companyId}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(400);
  const hrefs = await page.locator("ul a").evaluateAll((els) =>
    els.map((a) => ({
      text: (a.textContent || "").replace(/\s+/g, " ").trim(),
      href: a.getAttribute("href") || "",
    })),
  );
  const missing = [];
  for (const quickLabel of QUICK_LABELS) {
    const hit = hrefs.find((h) => h.text.startsWith(quickLabel));
    if (!hit || !hit.href.includes(accountId)) {
      missing.push(`${quickLabel}:${hit?.href || "missing"}`);
    }
  }
  if (missing.length) return fail(missing.join("; "));
  console.log("ok");
  return 0;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });

  let failed = 0;
  await waitForServer(page);

  process.stdout.write("… business-hub ");
  await page.goto(`${BASE}/bank/business?site=bank`, { waitUntil: "networkidle" });
  const hubText = await page.evaluate(() => document.body?.innerText ?? "");
  if (!/Business Banking/i.test(hubText)) failed += fail("missing Business Banking");
  else console.log("ok");

  failed += await assertHub(page, "CO-ALTG", CORE_ACCOUNT, "Core");
  failed += await assertHub(page, "CO-NPC", PRO_ACCOUNT, "Pro");

  for (const accountId of [CORE_ACCOUNT, PRO_ACCOUNT]) {
    for (const path of [
      "commercial/payments",
      "commercial/invoices",
      "commercial/payment-links",
      "commercial/payroll",
      "commercial/analytics",
      "representatives",
      "commercial/settings",
    ]) {
      process.stdout.write(`… open:${accountId}/${path} `);
      await page.goto(`${BASE}/bank/account/${accountId}/${path}?site=bank`, {
        waitUntil: "networkidle",
      });
      const pathname = new URL(page.url()).pathname;
      if (pathname === "/bank" || pathname === "/bank/") failed += fail("redirected /bank");
      else console.log("ok");
    }
  }

  process.stdout.write("… invoice-harbor-search ");
  await page.goto(`${BASE}/bank/account/${PRO_ACCOUNT}/commercial/invoices?site=bank`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.waitForTimeout(500);
  const dialog = page.locator("[role='dialog']");
  await dialog.getByPlaceholder("Search people or verified companies").fill("Harbor");
  await page.waitForTimeout(900);
  const dialogText = await dialog.innerText();
  if (!/Harbor Line/.test(dialogText) || !/Harbor Logistics/.test(dialogText)) {
    failed += fail("Harbor missing");
  } else {
    await dialog.locator("button").filter({ hasText: "Harbor Logistics" }).first().click();
    await page.waitForTimeout(300);
    console.log("ok");
  }
  await page.keyboard.press("Escape").catch(() => undefined);

  process.stdout.write("… payment-link-scroll-reset ");
  await page.goto(`${BASE}/bank/account/${PRO_ACCOUNT}/commercial/payment-links?site=bank`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "New link" }).click();
  await page.waitForTimeout(500);
  const scroll = page.locator("[data-bank-action-scroll]").first();
  await scroll.evaluate((el) => {
    el.scrollTop = 99999;
  });
  const inputs = page.locator("[role='dialog'] input, [role='dialog'] textarea");
  const count = await inputs.count();
  for (let i = 0; i < count; i += 1) {
    const el = inputs.nth(i);
    const type = await el.getAttribute("type");
    if (type === "hidden") continue;
    const ph = (await el.getAttribute("placeholder")) || "";
    if (/amount|0\.00|fld/i.test(ph) || type === "number") await el.fill("42").catch(() => undefined);
    else await el.fill("Walkthrough link").catch(() => undefined);
  }
  const continueBtn = page.getByRole("button", { name: /Continue|Next/i }).first();
  if (await continueBtn.count()) {
    await continueBtn.click();
    await page.waitForTimeout(600);
  }
  const top = await scroll.evaluate((el) => el.scrollTop);
  if (top > 8) failed += fail(`scrollTop=${top}`);
  else console.log(`ok (scrollTop=${top})`);
  await page.keyboard.press("Escape").catch(() => undefined);

  process.stdout.write("… analytics-percent ");
  await page.goto(`${BASE}/bank/account/${PRO_ACCOUNT}/commercial/analytics?site=bank`, {
    waitUntil: "networkidle",
  });
  const analyticsText = await page.evaluate(() => document.body?.innerText ?? "");
  if (/0\.97%|0\.03%/.test(analyticsText)) failed += fail("fractional percent");
  else if (!/97%/.test(analyticsText) || !/3%/.test(analyticsText)) failed += fail("missing 97%/3%");
  else console.log("ok");

  process.stdout.write("… billing-history-pro ");
  await page.goto(`${BASE}/bank/account/${PRO_ACCOUNT}/commercial/settings?site=bank`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(700);
  const proSettings = await page.evaluate(() => document.body?.innerText ?? "");
  if (!/Subscription billing history|Initial purchase|Monthly renewal/i.test(proSettings)) {
    failed += fail("missing Pro billing history");
  } else if (!/Failed|Insufficient funds/i.test(proSettings)) failed += fail("missing safe failure");
  else console.log("ok");

  process.stdout.write("… billing-history-core-empty ");
  await page.goto(`${BASE}/bank/account/${CORE_ACCOUNT}/commercial/settings?site=bank`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(700);
  const coreSettings = await page.evaluate(() => document.body?.innerText ?? "");
  if (!/No subscription charges on Core|Upgrade to Pro/i.test(coreSettings)) {
    failed += fail("missing Core empty billing state");
  } else console.log("ok");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 320, height: 568 },
  ]) {
    process.stdout.write(`… mobile-${viewport.width}x${viewport.height} `);
    await page.setViewportSize(viewport);
    await page.goto(`${BASE}/bank/account/${PRO_ACCOUNT}/commercial/payment-links?site=bank`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "New link" }).click();
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const s = document.querySelector("[data-bank-action-scroll]");
      const f = document.querySelector("[data-bank-action-footer]");
      if (!s || !f) return null;
      s.scrollTop = 99999;
      return {
        scrollTop: s.scrollTop,
        footerBottom: f.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
      };
    });
    const continueMobile = page.getByRole("button", { name: /Continue|Next/i }).first();
    if (await continueMobile.count()) {
      await continueMobile.click().catch(() => undefined);
      await page.waitForTimeout(400);
    }
    const after = await page.evaluate(() => {
      const s = document.querySelector("[data-bank-action-scroll]");
      const f = document.querySelector("[data-bank-action-footer]");
      if (!s || !f) return null;
      return {
        scrollTop: s.scrollTop,
        footerBottom: f.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight,
      };
    });
    if (!after) failed += fail("metrics null");
    else if (after.footerBottom > after.viewportHeight + 2) {
      failed += fail(`footer clipped (${after.footerBottom}>${after.viewportHeight})`);
    } else console.log(`ok (scrollTop=${after.scrollTop}; preScroll=${metrics?.scrollTop ?? "?"})`);
    await page.keyboard.press("Escape").catch(() => undefined);
  }

  process.stdout.write("… console-errors ");
  const hydration = pageErrors.filter((m) => /hydrat/i.test(m));
  if (hydration.length) failed += fail(`hydration: ${hydration[0]}`);
  else console.log(`ok (${pageErrors.length} total logged)`);

  await browser.close();
  if (failed > 0) {
    console.error(`\nWalkthrough failed: ${failed}`);
    process.exit(1);
  }
  console.log("\nWalkthrough passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
