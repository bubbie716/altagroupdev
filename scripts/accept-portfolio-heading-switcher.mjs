/**
 * Portfolio detail heading switcher QA at mobile widths.
 * Requires UI Lab mock server on :3000.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;

  async function run(viewport, name, fn) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(15000);
    const issues = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") issues.push(msg.text());
    });
    page.on("pageerror", (e) => issues.push(String(e)));
    try {
      const ok = await fn(page);
      const hydra = issues.filter((t) =>
        /hydrat|did not match|server HTML|Minified React error #418|#423|#425/i.test(t),
      );
      if (hydra.length) {
        console.error(name, "HYDRATION", hydra);
        allPass = false;
      } else if (!ok) allPass = false;
      else console.log(`=== ${name}: PASS ===`);
    } catch (e) {
      allPass = false;
      console.error(`=== ${name}: ERROR ===`, e.message || e);
    } finally {
      await page.close();
    }
  }

  for (const viewport of [
    { width: 320, height: 568, name: "320" },
    { width: 375, height: 667, name: "375" },
    { width: 390, height: 844, name: "390" },
    { width: 1280, height: 800, name: "desktop" },
  ]) {
    await run(viewport, viewport.name, async (page) => {
      let ok = true;
      await page.goto(`${BASE}/terminal/portfolio?site=terminal`, { waitUntil: "networkidle" });
      await page.waitForURL(/\/terminal\/portfolio\//);

      const header = await page.evaluate(() => {
        const h1s = [...document.querySelectorAll("h1")].map((h) => h.textContent?.trim());
        const trigger = document.querySelector('button[aria-label^="Current portfolio:"]');
        const borderedSwitchers = [...document.querySelectorAll("button")].filter((b) =>
          (b.getAttribute("aria-label") || "").startsWith("Portfolio switcher"),
        );
        const personalInHeader = (() => {
          if (!trigger) return 0;
          const text = trigger.innerText || "";
          return (text.match(/\bPersonal\b/g) || []).length;
        })();
        return {
          h1s,
          triggerLabel: trigger?.getAttribute("aria-label"),
          triggerText: trigger?.innerText?.replace(/\s+/g, " ").trim(),
          borderedCount: borderedSwitchers.length,
          personalInHeader,
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      console.log(viewport.name, "header", header);

      if (header.h1s.length !== 1) ok = fail(`expected 1 h1, got ${JSON.stringify(header.h1s)}`) && ok;
      if (!header.triggerLabel?.startsWith("Current portfolio:")) {
        ok = fail(`missing heading trigger: ${header.triggerLabel}`) && ok;
      }
      if (header.borderedCount > 0) ok = fail("old bordered switcher still present") && ok;
      if (header.personalInHeader !== 1 && header.triggerText?.includes("Personal")) {
        ok = fail(`Personal should appear once in trigger, got ${header.personalInHeader}`) && ok;
      }

      const trigger = page.getByRole("button", { name: /Current portfolio:/i });
      await trigger.click();
      await page.getByRole("menu").waitFor({ state: "visible" });

      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await page.waitForFunction(() =>
        document.activeElement?.getAttribute("aria-label")?.startsWith("Current portfolio:"),
      );

      await page.keyboard.press("Enter");
      await page.getByRole("menu").waitFor({ state: "visible" });

      const currentName = (await page.locator("h1").textContent())?.trim() ?? "";
      const targetName = /Growth/i.test(currentName) ? /Core Portfolio/i : /Growth Portfolio/i;
      const targetItem = page.getByRole("menuitem", { name: targetName });
      if ((await targetItem.count()) > 0) {
        const beforeUrl = page.url();
        await targetItem.click();
        await page.waitForFunction((prev) => location.href !== prev, beforeUrl, {
          timeout: 15000,
        });
        await page.waitForFunction(
          () => {
            const active = document.activeElement;
            const label = active?.getAttribute("aria-label") || "";
            return (
              label.startsWith("Current portfolio:") &&
              active === document.querySelector('button[aria-label^="Current portfolio:"]')
            );
          },
          { timeout: 15000 },
        );
        const afterFocus = await page.evaluate(() =>
          document.activeElement?.getAttribute("aria-label"),
        );
        console.log(viewport.name, "after select focus", afterFocus);
        if (!afterFocus?.startsWith("Current portfolio:")) {
          ok = fail(`focus not on heading after select: ${afterFocus}`) && ok;
        }
      } else {
        await page.keyboard.press("Escape");
        await page.getByRole("menu").waitFor({ state: "hidden" });
      }

      await trigger.focus();
      await page.keyboard.press(" ");
      await page.getByRole("menu").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await page.getByRole("menu").waitFor({ state: "hidden" });
      await page.waitForFunction(() =>
        document.activeElement?.getAttribute("aria-label")?.startsWith("Current portfolio:"),
      );

      if (header.overflowX) ok = fail("horizontal overflow") && ok;

      await page.emulateMedia({ colorScheme: "dark" });
      await page.reload({ waitUntil: "networkidle" });
      if (!(await page.getByRole("button", { name: /Current portfolio:/i }).isVisible())) {
        ok = fail("heading trigger missing in dark") && ok;
      }

      return ok;
    });
  }

  await browser.close();
  if (!allPass) {
    console.error("HEADING SWITCHER FAILED");
    process.exit(1);
  }
  console.log("HEADING SWITCHER ALL PASS");
})();
