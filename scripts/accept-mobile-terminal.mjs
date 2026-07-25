/**
 * UI Lab mobile accessibility acceptance for Terminal.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

async function overlayClean(page, label) {
  for (const ms of [0, 80, 200]) {
    if (ms) await page.waitForTimeout(ms);
    const snap = await page.evaluate(() => {
      const nodes = [
        ...document.querySelectorAll(
          "[data-radix-dialog-overlay], [data-radix-dialog-content], [role='dialog']",
        ),
      ];
      return nodes.map((el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          state: el.getAttribute("data-state"),
          opacity: Number(s.opacity),
          pointerEvents: s.pointerEvents,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      });
    });
    const sticky = snap.filter(
      (d) =>
        d.state === "closed" &&
        d.pointerEvents !== "none" &&
        d.opacity > 0.01 &&
        d.w > 0 &&
        d.h > 0,
    );
    const open = snap.filter((d) => d.state === "open" && d.opacity > 0.01 && d.w > 0);
    if (!sticky.length && !open.length) {
      console.log(label, "PASS clean @", ms);
      return true;
    }
    if (ms === 200) {
      console.log(label, "FAIL", JSON.stringify({ sticky, open }));
      return false;
    }
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
      console.error(`=== ${name}: ERROR ===`, e.message || e);
    } finally {
      await page.close();
    }
  }

  // Desktop: chart range URL + desktop ticket unchanged
  await run({ width: 1280, height: 800 }, "desktop-range", async (page) => {
    let ok = true;
    await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1D`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "1W", pressed: false }).click();
    await page.waitForURL(/range=1W/);
    if (!page.url().includes("range=1W")) ok = fail("range not in URL") && ok;
    await page.getByRole("button", { name: "1M" }).click();
    await page.waitForURL(/range=1M/);
    await page.goBack();
    await page.waitForURL(/range=1W/);
    console.log("desktop range back", page.url());
    // Desktop aside ticket still present
    if (!(await page.locator("aside").getByRole("button", { name: /Review/i }).isVisible())) {
      ok = fail("desktop ticket missing") && ok;
    }
    if (await page.getByRole("button", { name: /^Buy$/i }).count()) {
      // Buy action bar should be lg:hidden — may still be in DOM with display none
      const visible = await page
        .getByRole("region", { name: "Trade actions" })
        .isVisible()
        .catch(() => false);
      if (visible) ok = fail("mobile trade bar visible on desktop") && ok;
    }
    return ok;
  });

  for (const viewport of [
    { width: 390, height: 844, name: "mobile-390" },
    { width: 375, height: 667, name: "mobile-375" },
    { width: 320, height: 568, name: "mobile-320" },
  ]) {
    await run(viewport, viewport.name, async (page) => {
      let ok = true;
      await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1D`, {
        waitUntil: "networkidle",
      });

      // Chart not covered: trade bar is Buy/Sell only
      const tradeBar = page.getByRole("region", { name: "Trade actions" });
      if (!(await tradeBar.isVisible())) ok = fail("trade bar missing") && ok;
      const chart = page.getByRole("img", { name: /Price history/i });
      const chartBox = await chart.boundingBox();
      const barBox = await tradeBar.boundingBox();
      const quote = page.getByRole("heading", { level: 1 });
      const quoteBox = await quote.boundingBox();
      if (quoteBox && barBox && quoteBox.y + quoteBox.height > barBox.y) {
        ok = fail("quote obscured by trade bar") && ok;
      }
      if (chartBox && barBox) {
        const visibleBottom = Math.min(chartBox.y + chartBox.height, barBox.y);
        const visibleHeight = Math.max(0, visibleBottom - chartBox.y);
        console.log(viewport.name, "visible chart above bar", visibleHeight);
        // On very short viewports the chart may start near the bar; identity/price must stay clear.
        if (viewport.height >= 667 && visibleHeight < 120) {
          ok = fail(`chart cramped above trade bar (${visibleHeight}px)`) && ok;
        }
      }

      // Open buy sheet
      await page.getByRole("button", { name: /^Buy$/i }).click();
      const orderSheet = page.getByRole("dialog").filter({ hasText: /Buy ALTA/i });
      await orderSheet.waitFor();
      await orderSheet.locator('input[type="number"]').first().fill("4");
      await orderSheet.getByRole("button", { name: /^limit$/i }).click();

      // Switch portfolio from sheet
      await orderSheet.getByRole("button", { name: /Trading portfolio:/i }).click();
      await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();
      const closeBtn = page.getByRole("button", { name: "Close" }).last();
      const closeBox = await closeBtn.boundingBox();
      if (closeBox && (closeBox.width < 40 || closeBox.height < 40)) {
        ok = fail(`close hit target too small ${JSON.stringify(closeBox)}`) && ok;
      }
      const growth = page.getByRole("option", { name: /Growth Portfolio/i });
      if ((await growth.count()) > 0) await growth.click();
      else await page.locator('[role="option"]:not([aria-disabled="true"])').nth(1).click();
      await page.waitForURL(/portfolioId=/);
      if (!page.url().includes("range=1D")) ok = fail("range lost on portfolio switch") && ok;

      // Order sheet should remain open with preserved inputs
      await orderSheet.waitFor({ state: "visible", timeout: 8000 });
      const qty = await orderSheet.locator('input[type="number"]').first().inputValue();
      if (qty !== "4") ok = fail(`qty not preserved: ${qty}`) && ok;

      // Close sheet and reopen
      await page.keyboard.press("Escape");
      // May need second Escape if picker somehow still open
      await page.waitForTimeout(100);
      ok = (await overlayClean(page, `${viewport.name} after sheet close`)) && ok;
      await page.getByRole("button", { name: /^Buy$/i }).click();
      await orderSheet.waitFor();
      const qty2 = await orderSheet.locator('input[type="number"]').first().inputValue();
      if (qty2 !== "4") ok = fail(`qty lost after reopen: ${qty2}`) && ok;
      await page.keyboard.press("Escape");

      // Range URL
      await page.getByRole("button", { name: "1W" }).click();
      await page.waitForURL(/range=1W/);
      if (!page.url().includes("portfolioId=")) ok = fail("portfolioId lost on range") && ok;

      // Narrow search on 320
      if (viewport.width <= 360) {
        const searchBtn = page.getByRole("button", { name: "Search symbols" });
        if (!(await searchBtn.isVisible())) ok = fail("search icon missing at narrow width") && ok;
        await searchBtn.click();
        await page.getByRole("heading", { name: "Search symbols" }).waitFor();
        await page.getByPlaceholder("Symbol or company").fill("ALTA");
        await page.getByRole("option").first().waitFor({ timeout: 5000 }).catch(() => null);
        if ((await page.getByRole("option").count()) > 0) {
          await page.getByRole("option").first().click();
          await page.waitForURL(/\/terminal\/security\//);
          ok = (await overlayClean(page, `${viewport.name} search select`)) && ok;
        }
      }

      // Profile header not clipped
      await page.goto(`${BASE}/profile?site=terminal`, { waitUntil: "networkidle" });
      const headerTop = await page.locator("header").first().evaluate((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return { top: r.top, cssTop: s.top };
      });
      const bannerH = await page.evaluate(
        () => getComputedStyle(document.documentElement).getPropertyValue("--ui-lab-banner-height").trim(),
      );
      console.log(viewport.name, "profile header", headerTop, "banner", bannerH);
      if (headerTop.top < 1 && bannerH && bannerH !== "0px") {
        ok = fail("header still at top:0 under banner") && ok;
      }

      return ok;
    });
  }

  await browser.close();
  if (!allPass) process.exit(1);
  console.log("ALL PASS");
})();
