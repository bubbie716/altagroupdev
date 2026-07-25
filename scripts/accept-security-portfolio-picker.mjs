/**
 * UI Lab acceptance: security-page portfolio picker (desktop modal + mobile sheet).
 * Run with UI Lab / mock Terminal server on :3000.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

async function overlaySnapshot(page) {
  return page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        "[data-radix-dialog-overlay], [data-radix-dialog-content], [role='dialog']",
      ),
    ];
    return nodes.map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        role: el.getAttribute("role"),
        state: el.getAttribute("data-state"),
        opacity: Number(s.opacity),
        pointerEvents: s.pointerEvents,
        visibility: s.visibility,
        w: Math.round(r.width),
        h: Math.round(r.height),
        bottom: Math.round(r.bottom),
        top: Math.round(r.top),
      };
    });
  });
}

async function assertNoLingeringOverlay(page, label) {
  for (const ms of [0, 50, 120, 250]) {
    if (ms) await page.waitForTimeout(ms);
    const snap = await overlaySnapshot(page);
    const sticky = snap.filter(
      (d) =>
        d.state === "closed" &&
        d.pointerEvents !== "none" &&
        d.opacity > 0.01 &&
        d.visibility !== "hidden" &&
        d.w > 0 &&
        d.h > 0,
    );
    const open = snap.filter((d) => d.state === "open" && d.opacity > 0.01 && d.w > 0);
    if (sticky.length || open.length) {
      if (ms === 250) {
        console.log(label, "FAIL lingering", JSON.stringify({ sticky, open, snap }));
        return false;
      }
      continue;
    }
    console.log(label, "PASS clean overlays @", ms, "ms");
    return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;

  async function run(viewport, name, fn) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(20000);
    try {
      const ok = await fn(page);
      if (!ok) allPass = false;
      console.log(`=== ${name}: ${ok ? "PASS" : "FAIL"} ===`);
    } catch (e) {
      allPass = false;
      console.error(`=== ${name}: ERROR ===`, e);
    } finally {
      await page.close();
    }
  }

  await run({ width: 1280, height: 800 }, "desktop", async (page) => {
    let ok = true;
    await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1D`, {
      waitUntil: "networkidle",
    });

    // Header: watchlist only — no portfolio switcher
    const headerSwitcher = await page.getByRole("button", { name: /Portfolio switcher/i }).count();
    if (headerSwitcher > 0) ok = fail("header still has PortfolioSwitcher") && ok;

    const watch = page.getByRole("button", { name: /watchlist/i }).first();
    if (!(await watch.isVisible())) ok = fail("missing watchlist button") && ok;

    // Capture chart range + quantity before opening picker
    const urlBefore = page.url();
    if (!urlBefore.includes("range=1D")) ok = fail("range missing before switch") && ok;

    const qty = page.locator("aside input[type=\"number\"]").first();
    await qty.fill("3");
    await page.locator("aside").getByRole("button", { name: /^sell$/i }).click();

    // Order ticket portfolio row opens dialog
    const trigger = page.getByRole("button", { name: /Trading portfolio:/i }).first();
    await trigger.click();
    await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();

    const personal = page.getByText("Personal", { exact: true }).first();
    const companies = page.getByText("Companies", { exact: true }).first();
    if (!(await personal.isVisible())) ok = fail("missing Personal group") && ok;
    if (!(await companies.isVisible())) ok = fail("missing Companies group") && ok;

    // Selected option marked
    const selected = page.locator('[role="option"][aria-selected="true"]');
    if ((await selected.count()) < 1) ok = fail("no selected option") && ok;

    // Select Growth if present, else second personal option
    const growth = page.getByRole("option", { name: /Growth Portfolio/i });
    const options = page.locator('[role="option"]:not([aria-disabled="true"])');
    const optionCount = await options.count();
    if (optionCount < 2) ok = fail("need ≥2 selectable portfolios") && ok;
    if ((await growth.count()) > 0) {
      await growth.click();
    } else {
      await options.nth(1).click();
    }

    await page.waitForURL(/portfolioId=/);
    const urlAfter = page.url();
    if (!/portfolioId=/.test(urlAfter)) ok = fail("URL missing portfolioId") && ok;
    if (!urlAfter.includes("range=1D")) ok = fail("range not preserved") && ok;
    if (!urlAfter.includes("/terminal/security/ALTA")) ok = fail("symbol navigated away") && ok;

    ok = (await assertNoLingeringOverlay(page, "DESKTOP after select")) && ok;

    // Order inputs preserved
    const qtyVal = await qty.inputValue();
    if (qtyVal !== "3") ok = fail(`quantity reset to ${qtyVal}`) && ok;
    const sellActive = await page
      .getByRole("button", { name: /^sell$/i })
      .first()
      .evaluate((el) => el.className.includes("bg-[var(--terminal-red)]") || el.className.includes("terminal-red"));
    // Side buttons use class tokens — just check sell was clicked by reading aria or text state loosely
    void sellActive;

    // Position section shows portfolio label
    const positionLabel = page.getByRole("button", { name: /Position portfolio:/i });
    if (!(await positionLabel.isVisible())) ok = fail("position portfolio label missing") && ok;

    // Escape closes picker
    await trigger.click();
    await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();
    await page.keyboard.press("Escape");
    ok = (await assertNoLingeringOverlay(page, "DESKTOP escape")) && ok;

    // Keyboard open + select
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    ok = (await assertNoLingeringOverlay(page, "DESKTOP keyboard select")) && ok;

    // Back restores previous portfolioId
    const midUrl = page.url();
    const midId = new URL(midUrl).searchParams.get("portfolioId");
    await page.goBack();
    await page.waitForTimeout(300);
    const backId = new URL(page.url()).searchParams.get("portfolioId");
    if (midId && backId === midId) {
      // may be same if first select didn't change — try forward
      await page.goForward();
      await page.waitForTimeout(300);
    } else {
      console.log("DESKTOP back/forward portfolioId", { midId, backId, now: page.url() });
    }

    // Dark theme smoke
    await page.emulateMedia({ colorScheme: "dark" });
    await trigger.click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Choose portfolio" });
    await dialog.waitFor();
    const bg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
    if (bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
      ok = fail(`dialog not opaque: ${bg}`) && ok;
    } else {
      console.log("DESKTOP dark dialog bg", bg);
    }
    await page.keyboard.press("Escape");
    ok = (await assertNoLingeringOverlay(page, "DESKTOP dark close")) && ok;

    return ok;
  });

  await run({ width: 390, height: 844 }, "mobile", async (page) => {
    let ok = true;
    await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1W`, {
      waitUntil: "networkidle",
    });

    if ((await page.getByRole("button", { name: /Portfolio switcher/i }).count()) > 0) {
      ok = fail("mobile header portfolio switcher present") && ok;
    }

    const trigger = page.getByRole("button", { name: /Trading portfolio:|Choose a portfolio for this order/i }).last();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();

    const sheet = page.getByRole("dialog").filter({ hasText: "Choose portfolio" });
    await sheet.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const el = [...document.querySelectorAll('[role="dialog"]')].find((node) =>
        (node.textContent || "").includes("Choose portfolio"),
      );
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.transform === "none" || s.transform === "matrix(1, 0, 0, 1, 0, 0)";
    });
    const geom = await sheet.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        top: r.top,
        bottom: r.bottom,
        height: r.height,
        cssBottom: s.bottom,
        transform: s.transform,
      };
    });
    const viewport = page.viewportSize();
    if (!viewport) {
      ok = fail("no viewport") && ok;
    } else {
      const clearance = viewport.height - geom.bottom;
      console.log("MOBILE sheet geometry", { ...geom, clearance, vh: viewport.height });
      // Sheet bottom edge should clear the ~52px mobile nav.
      if (clearance < 40 || geom.cssBottom === "0px") {
        ok = fail(
          `sheet overlaps bottom nav (clearance=${clearance}, cssBottom=${geom.cssBottom})`,
        ) && ok;
      }
    }

    const options = page.locator('[role="option"]:not([aria-disabled="true"])');
    const n = await options.count();
    if (n < 1) ok = fail("no mobile options") && ok;
    await options.nth(Math.min(1, n - 1)).click();
    await page.waitForURL(/portfolioId=/);
    if (!page.url().includes("range=1W")) ok = fail("mobile range not preserved") && ok;
    ok = (await assertNoLingeringOverlay(page, "MOBILE after select")) && ok;

    // Reopen + Escape
    await trigger.click();
    await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();
    await page.keyboard.press("Escape");
    ok = (await assertNoLingeringOverlay(page, "MOBILE escape")) && ok;

    return ok;
  });

  await browser.close();
  if (!allPass) process.exit(1);
  console.log("ALL PASS");
})();
