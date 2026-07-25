/**
 * UI Lab Quick Trade acceptance — desktop + 320/375/390, light/dark.
 * Requires: VITE_UI_LAB_MODE=true and mock TSE on :3000.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const HOME = `${BASE}/terminal?site=terminal`;

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

async function overlaysClean(page) {
  for (const ms of [0, 80, 200]) {
    if (ms) await page.waitForTimeout(ms);
    const sticky = await page.evaluate(() => {
      return [...document.querySelectorAll("[data-radix-dialog-overlay], [role='dialog']")]
        .map((el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            state: el.getAttribute("data-state"),
            opacity: Number(s.opacity),
            pointerEvents: s.pointerEvents,
            w: Math.round(r.width),
            h: Math.round(r.height),
          };
        })
        .filter(
          (d) =>
            d.state === "closed" &&
            d.pointerEvents !== "none" &&
            d.opacity > 0.01 &&
            d.w > 0 &&
            d.h > 0,
        );
    });
    if (!sticky.length) return true;
    if (ms === 200) {
      console.error("sticky overlays", JSON.stringify(sticky));
      return false;
    }
  }
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

async function runViewport(browser, viewport, name, theme) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(25000);
  const issues = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (/hydrat|did not match|Minified React error #418|#423|#425/i.test(text)) {
      issues.push(text);
    }
  });
  page.on("pageerror", (err) => issues.push(String(err)));

  let ok = true;
  try {
    await page.goto(HOME, { waitUntil: "networkidle" });
    await setTheme(page, theme);

    const trade = page.getByRole("button", { name: "Trade", exact: true });
    await trade.waitFor({ state: "visible" });

    // View markets still navigates
    const markets = page.getByRole("link", { name: "View markets" });
    await markets.waitFor({ state: "visible" });

    await trade.click();
    const dialog = page.getByRole("dialog", { name: /Quick Trade/i });
    await dialog.waitFor({ state: "visible" });

    // No horizontal overflow on the dialog surface
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"][data-state="open"]');
      if (!el) return { doc: true, dialog: true };
      return {
        doc: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        dialog: el.scrollWidth > el.clientWidth + 1,
      };
    });
    if (overflow.doc || overflow.dialog) {
      ok = fail(`${name}/${theme}: horizontal overflow ${JSON.stringify(overflow)}`) && ok;
    }

    // Reachable primary Review appears after selecting a ticker
    const ticker = dialog.getByLabel(/Ticker/i);
    await ticker.fill("ALTA");
    await page.waitForTimeout(300);
    const option = page.getByRole("option").filter({ hasText: "ALTA" }).first();
    if (await option.count()) {
      await option.click();
    } else {
      await ticker.press("Enter");
    }
    await dialog.getByRole("button", { name: /Review buy/i }).waitFor({ state: "visible" });

    // Close via Escape; restore focus to Trade
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    if (!(await overlaysClean(page))) {
      ok = fail(`${name}/${theme}: sticky overlay after Escape`) && ok;
    }
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (focused !== "Trade") {
      ok = fail(`${name}/${theme}: focus not restored to Trade (got "${focused}")`) && ok;
    }

    if (issues.length) {
      ok = fail(`${name}/${theme}: hydration/console ${issues.join(" | ")}`) && ok;
    }

    console.log(`=== ${name}/${theme}: ${ok ? "PASS" : "FAIL"} ===`);
    return ok;
  } catch (e) {
    console.error(`=== ${name}/${theme}: ERROR ===`, e.message || e);
    return false;
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;
  const viewports = [
    { width: 1280, height: 800, name: "desktop" },
    { width: 390, height: 844, name: "390" },
    { width: 375, height: 667, name: "375" },
    { width: 320, height: 568, name: "320" },
  ];
  for (const vp of viewports) {
    for (const theme of ["light", "dark"]) {
      const ok = await runViewport(browser, { width: vp.width, height: vp.height }, vp.name, theme);
      if (!ok) allPass = false;
    }
  }
  await browser.close();
  if (!allPass) process.exit(1);
  console.log("Quick Trade UI Lab accept: ALL PASS");
})();
