/**
 * UI Lab smoke — Bank home redesign.
 * Requires: VITE_UI_LAB_MODE=true on :3000.
 */
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";

const PAGES = [
  { name: "bank-home", url: `${BASE}/bank?site=bank`, expect: [/Available balance|Banking|Move money/i] },
  { name: "bank-dashboard-redirect", url: `${BASE}/bank/dashboard?site=bank`, expect: [/Available balance|Move money/i] },
  { name: "accounts", url: `${BASE}/bank/accounts?site=bank`, expect: [/Accounts/i] },
  { name: "activity", url: `${BASE}/bank/activity?site=bank`, expect: [/Activity/i] },
];

const FORBIDDEN = [/Private Banking/i, /Alta Private/i, /isPrivateClient/];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  let failed = 0;

  for (const spec of PAGES) {
    process.stdout.write(`… ${spec.name} `);
    try {
      const res = await page.goto(spec.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      const status = res?.status() ?? 0;
      if (status >= 500) {
        console.log(`FAIL http ${status}`);
        failed += 1;
        continue;
      }
      let ok = true;
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          console.log(`FAIL forbidden ${pattern}`);
          ok = false;
        }
      }
      for (const pattern of spec.expect) {
        if (!pattern.test(text)) {
          console.log(`FAIL missing ${pattern}`);
          ok = false;
        }
      }
      // Primary nav should not list Deposit as a top-level desktop link label cluster
      const nav = await page.locator("header nav[aria-label='Bank primary']").innerText().catch(() => "");
      if (nav && /Deposit|Withdraw|Statements|Settings/i.test(nav)) {
        console.log("FAIL primary nav still crowded");
        ok = false;
      }
      if (nav && !/Home|Accounts|Activity/i.test(nav)) {
        console.log("FAIL primary nav missing core links");
        ok = false;
      }
      // Alta Card / Lending may appear when credit desk permits — do not require them.
      if (ok) console.log("ok");
      else failed += 1;
    } catch (err) {
      console.log(`FAIL ${err}`);
      failed += 1;
    }
  }

  // Mobile bottom nav
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/bank?site=bank`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const mobileNav = await page.locator("nav[aria-label='Bank mobile']").innerText().catch(() => "");
  process.stdout.write("… mobile-nav ");
  if (!/Home|Accounts|Activity|More/i.test(mobileNav)) {
    console.log("FAIL");
    failed += 1;
  } else {
    console.log("ok");
  }

  await browser.close();
  console.log(failed ? `\nFailed ${failed}` : "\nAll smoke checks passed");
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
