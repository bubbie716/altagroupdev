/**
 * UI Lab acceptance — Private Banking removed; Gold Card standalone.
 * Requires: VITE_UI_LAB_MODE=true on :3000.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const PAGES = [
  { name: "bank-home", url: `${BASE}/bank?site=bank` },
  { name: "bank-products", url: `${BASE}/bank/products?site=bank` },
  { name: "alta-card", url: `${BASE}/bank/alta-card?site=bank` },
  { name: "alta-card-business", url: `${BASE}/bank/alta-card/business?site=bank` },
  { name: "alta-card-apply", url: `${BASE}/bank/alta-card?apply=1&site=bank` },
  { name: "lending", url: `${BASE}/bank/lending?site=bank` },
  { name: "profile", url: `${BASE}/profile?site=bank` },
  { name: "internal", url: `${BASE}/internal?site=bank` },
  { name: "internal-alta-card", url: `${BASE}/internal/alta-card?site=bank` },
  { name: "removed-private", url: `${BASE}/bank/private?site=bank`, expectNotFound: true },
  { name: "removed-private-queue", url: `${BASE}/internal/queues/private-banking?site=bank`, expectNotFound: true },
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
];

const FORBIDDEN = [/Alta Private/i, /Private Banking/i, /Private Client/i, /\/bank\/private/i];

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
}

async function pageText(page) {
  return page.evaluate(() => document.body?.innerText ?? "");
}

async function runCase(browser, viewport, theme, pageSpec) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(25000);
  const issues = [];
  page.on("pageerror", (err) => issues.push(String(err)));

  let ok = true;
  try {
    const res = await page.goto(pageSpec.url, { waitUntil: "networkidle" });
    await setTheme(page, theme);
    await page.waitForTimeout(300);

    const status = res?.status() ?? 0;
    const text = await pageText(page);
    const title = await page.title();

    if (pageSpec.expectNotFound) {
      const looksMissing =
        status === 404 ||
        /not found|doesn't exist|page not found|404/i.test(text) ||
        /not found/i.test(title);
      if (!looksMissing) {
        ok = fail(`${pageSpec.name}: expected not-found for ${pageSpec.url} (status=${status})`);
      }
      if (/Alta Private|Private Banking/i.test(text)) {
        ok = fail(`${pageSpec.name}: not-found page mentions Private Banking`);
      }
    } else {
      if (status >= 400) {
        ok = fail(`${pageSpec.name}: HTTP ${status}`);
      }
      for (const pattern of FORBIDDEN) {
        if (pattern.test(text)) {
          ok = fail(`${pageSpec.name}: forbidden copy matched ${pattern}`);
        }
      }
      if (pageSpec.name === "alta-card" || pageSpec.name === "alta-card-apply") {
        if (!/Alta Gold|ALTA GOLD|Gold/i.test(text)) {
          ok = fail(`${pageSpec.name}: expected Alta Gold discoverability`);
        }
      }
      if (pageSpec.name === "alta-card-business") {
        if (!/Business Alta Card|Alta Card/i.test(text)) {
          ok = fail(`${pageSpec.name}: expected Business Alta Card surface`);
        }
      }
      if (pageSpec.name === "bank-home" || pageSpec.name === "alta-card" || pageSpec.name === "internal") {
        const nav = await page.locator("nav, header").allInnerTexts();
        const navText = nav.join("\n");
        if (/Alta Private|Private Banking/i.test(navText)) {
          ok = fail(`${pageSpec.name}: Private Banking still in nav`);
        }
      }
    }

    if (issues.length) {
      ok = fail(`${pageSpec.name}: console/page errors ${issues.join(" | ")}`);
    }
  } catch (err) {
    ok = fail(`${pageSpec.name}: ${err}`);
  } finally {
    await page.close();
  }
  return ok;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  let failed = 0;

  try {
    for (const viewport of VIEWPORTS) {
      for (const theme of ["light", "dark"]) {
        for (const pageSpec of PAGES) {
          const label = `${viewport.name}/${theme}/${pageSpec.name}`;
          process.stdout.write(`… ${label} `);
          const ok = await runCase(browser, viewport, theme, pageSpec);
          if (ok) {
            console.log("ok");
            passed += 1;
          } else {
            failed += 1;
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\nPassed ${passed}, failed ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
