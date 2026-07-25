/**
 * Fresh-load hydration + focus QA for Terminal mobile stabilization.
 * Requires UI Lab mock server on :3000.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

async function collectConsole(page) {
  const errors = [];
  const warnings = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") errors.push(text);
    if (msg.type() === "warning") warnings.push(text);
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return {
    errors,
    warnings,
    hydrationIssues() {
      return [...errors, ...warnings].filter((t) =>
        /hydrat|did not match|server HTML|Minified React error #418|#423|#425/i.test(t),
      );
    },
  };
}

async function overlaysGone(page) {
  for (const ms of [0, 80, 200]) {
    if (ms) await page.waitForTimeout(ms);
    const open = await page.evaluate(() => {
      return [...document.querySelectorAll('[role="dialog"], [data-radix-dialog-overlay]')].filter(
        (el) => {
          const s = getComputedStyle(el);
          const state = el.getAttribute("data-state");
          return (
            state === "open" &&
            s.pointerEvents !== "none" &&
            Number(s.opacity) > 0.01 &&
            el.getBoundingClientRect().width > 0
          );
        },
      ).length;
    });
    if (open === 0) return true;
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;

  async function run(viewport, name, fn) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(20000);
    const consoleProbe = await collectConsole(page);
    try {
      const ok = await fn(page, consoleProbe);
      const hydra = consoleProbe.hydrationIssues();
      if (hydra.length) {
        console.error(name, "HYDRATION", hydra);
        allPass = false;
      } else if (!ok) {
        allPass = false;
      } else {
        console.log(`=== ${name}: PASS (no hydration issues) ===`);
      }
    } catch (e) {
      allPass = false;
      console.error(`=== ${name}: ERROR ===`, e.message || e);
      const hydra = consoleProbe.hydrationIssues();
      if (hydra.length) console.error(name, "HYDRATION", hydra);
    } finally {
      await page.close();
    }
  }

  for (const viewport of [
    { width: 1280, height: 800, name: "desktop" },
    { width: 390, height: 844, name: "mobile-390" },
    { width: 375, height: 667, name: "mobile-375" },
    { width: 320, height: 568, name: "mobile-320" },
  ]) {
    await run(viewport, viewport.name, async (page, consoleProbe) => {
      let ok = true;

      // Fresh document load (not SPA transition)
      await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1D`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(300);

      const hydraEarly = consoleProbe.hydrationIssues();
      if (hydraEarly.length) ok = fail(`hydration on security load: ${hydraEarly.join(" | ")}`) && ok;

      // No layout flash markers: both trees present, CSS hides inactive
      const chrome = await page.evaluate(() => {
        const aside = document.querySelector("aside");
        const trade = document.querySelector('[aria-label="Trade actions"]');
        const searchIcon = [...document.querySelectorAll('button[aria-label="Search symbols"]')].find(
          (b) => getComputedStyle(b).display !== "none",
        );
        const searchInput = [...document.querySelectorAll('input[aria-label="Search symbols"]')].find(
          (i) => getComputedStyle(i).display !== "none" && i.offsetParent !== null,
        );
        return {
          asideDisplay: aside ? getComputedStyle(aside).display : null,
          tradeDisplay: trade ? getComputedStyle(trade).display : null,
          tradeInA11y: trade
            ? trade.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ??
              getComputedStyle(trade).display !== "none"
            : false,
          searchIconVisible: Boolean(searchIcon),
          searchInputVisible: Boolean(searchInput),
        };
      });
      console.log(viewport.name, "chrome", chrome);

      if (viewport.width >= 1024) {
        if (chrome.asideDisplay === "none") ok = fail("desktop aside hidden") && ok;
        if (chrome.tradeInA11y) ok = fail("trade bar visible on desktop") && ok;
        if (!chrome.searchInputVisible) ok = fail("inline search missing on desktop") && ok;
      } else {
        if (chrome.asideDisplay !== "none") ok = fail("desktop aside visible on mobile") && ok;
        if (!chrome.tradeInA11y) ok = fail("trade bar missing on mobile") && ok;
        if (viewport.width < 360) {
          if (!chrome.searchIconVisible) ok = fail("search icon missing <360") && ok;
          if (chrome.searchInputVisible) ok = fail("inline search visible <360") && ok;
        } else {
          if (!chrome.searchInputVisible) ok = fail("inline search missing ≥360") && ok;
        }
      }

      if (viewport.width < 1024) {
        // Chart clearance vs trade bar
        const geom = await page.evaluate(() => {
          const chart = document.querySelector('[role="img"][aria-label*="Price history"]');
          const bar = document.querySelector('[aria-label="Trade actions"]');
          if (!chart || !bar) return null;
          const c = chart.getBoundingClientRect();
          const b = bar.getBoundingClientRect();
          return {
            visible: Math.max(0, Math.min(c.bottom, b.top) - c.top),
            chartH: c.height,
            clearance: b.top - c.bottom,
          };
        });
        console.log(viewport.name, "chart geom", geom);
        if (geom && viewport.width <= 320) {
          if (geom.visible < 100 || geom.chartH < 96) {
            ok = fail(`320 chart still cramped (visible=${geom.visible}, h=${geom.chartH})`) && ok;
          }
          if (geom.clearance < -8) {
            ok = fail(`320 chart overlaps trade bar by ${-geom.clearance}px`) && ok;
          }
        }
        if (geom && viewport.width >= 375 && geom.visible < 160) {
          ok = fail(`chart cramped (${geom.visible}px)`) && ok;
        }

        // Open Buy — focus close button
        await page.getByRole("button", { name: /^Buy$/i }).click();
        const orderSheet = page.getByRole("dialog").filter({ hasText: /Buy ALTA/i });
        await orderSheet.waitFor();
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            label: el?.getAttribute("aria-label") || el?.textContent?.trim().slice(0, 40),
            hasCloseAttr: el?.hasAttribute("data-dialog-close") ?? false,
            tag: el?.tagName,
          };
        });
        console.log(viewport.name, "order focus", focused);
        if (!focused.hasCloseAttr) ok = fail(`order sheet focus not on close: ${JSON.stringify(focused)}`) && ok;

        await orderSheet.locator('input[type="number"]').first().fill("4");

        // Portfolio picker nested
        await orderSheet.getByRole("button", { name: /Trading portfolio:/i }).click();
        await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();
        const pickerFocus = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            hasCloseAttr: el?.hasAttribute("data-dialog-close") ?? false,
            label: el?.textContent?.trim().slice(0, 40),
          };
        });
        console.log(viewport.name, "picker focus", pickerFocus);
        if (!pickerFocus.hasCloseAttr) {
          ok = fail(`picker focus not on close: ${JSON.stringify(pickerFocus)}`) && ok;
        }

        const growth = page.getByRole("option", { name: /Growth Portfolio/i });
        if ((await growth.count()) > 0) await growth.click();
        else await page.locator('[role="option"]:not([aria-disabled="true"])').nth(1).click();
        await page.waitForURL(/portfolioId=/);

        await orderSheet.waitFor({ state: "visible" });
        const qty = await orderSheet.locator('input[type="number"]').first().inputValue();
        if (qty !== "4") ok = fail(`qty lost: ${qty}`) && ok;

        // Review → Back
        await orderSheet.getByRole("button", { name: /Review/i }).click();
        await page.getByRole("heading", { name: "Confirm order" }).waitFor();
        await page.getByRole("button", { name: /^Back$/i }).click();
        await orderSheet.waitFor({ state: "visible" });
        const qtyAfter = await orderSheet.locator('input[type="number"]').first().inputValue();
        if (qtyAfter !== "4") ok = fail(`qty lost after confirm back: ${qtyAfter}`) && ok;

        // Close via the close control (restores focus to Buy/Sell)
        await orderSheet.getByRole("button", { name: "Close" }).click();
        if (!(await overlaysGone(page))) ok = fail("overlays remain after order close") && ok;
        const afterClose = await page.evaluate(() => {
          const el = document.activeElement;
          return el?.textContent?.trim().slice(0, 20) || el?.getAttribute("aria-label");
        });
        console.log(viewport.name, "focus after close", afterClose);
        if (!/^(Buy|Sell)$/i.test(String(afterClose))) {
          ok = fail(`focus not restored to trade control: ${afterClose}`) && ok;
        }
      } else {
        // Desktop ticket present
        if (!(await page.locator("aside").getByRole("button", { name: /Review/i }).isVisible())) {
          ok = fail("desktop review missing") && ok;
        }
      }

      // Home + compact search on 320
      await page.goto(`${BASE}/terminal?site=terminal`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);
      if (consoleProbe.hydrationIssues().length) {
        ok = fail(`hydration on home: ${consoleProbe.hydrationIssues().join(" | ")}`) && ok;
      }
      if (viewport.width < 360) {
        await page.getByRole("button", { name: "Search symbols" }).click();
        await page.getByRole("heading", { name: "Search symbols" }).waitFor();
        await page.getByPlaceholder("Symbol or company").fill("GOLD");
        await page.waitForTimeout(400);
        const opt = page.getByRole("option").first();
        if ((await opt.count()) > 0) {
          await opt.click();
          await page.waitForURL(/\/terminal\/security\//);
          if (!(await overlaysGone(page))) ok = fail("search overlay remained") && ok;
        }
      }

      // Dark theme quick check on security
      await page.emulateMedia({ colorScheme: "dark" });
      await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1W`, {
        waitUntil: "networkidle",
      });
      await page.waitForTimeout(200);
      if (consoleProbe.hydrationIssues().length) {
        ok = fail(`hydration dark: ${consoleProbe.hydrationIssues().join(" | ")}`) && ok;
      }

      return ok;
    });
  }

  await browser.close();
  if (!allPass) process.exit(1);
  console.log("ALL PASS");
})();
