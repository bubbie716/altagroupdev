/**
 * Nested dialog focus restoration: order sheet ↔ portfolio picker.
 * UI Lab mock server on :3000. Viewport 390×844.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const VIEWPORT = { width: 390, height: 844 };

function fail(msg) {
  console.error("FAIL:", msg);
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  page.setDefaultTimeout(20000);

  const consoleIssues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleIssues.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => consoleIssues.push(`pageerror: ${err}`));

  let ok = true;

  async function openBuySheet() {
    await page.goto(`${BASE}/terminal/security/ALTA?site=terminal&range=1D`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: /^Buy$/i }).click();
    const sheet = page.getByRole("dialog").filter({ hasText: /Buy ALTA/i });
    await sheet.waitFor();
    return sheet;
  }

  async function openPickerFromSheet(sheet) {
    const trigger = sheet.getByRole("button", { name: /Trading portfolio:/i });
    await trigger.click();
    await page.getByRole("heading", { name: "Choose portfolio" }).waitFor();
    return trigger;
  }

  function hydrationHits() {
    return consoleIssues.filter((t) =>
      /hydrat|did not match|server HTML|Minified React error #418|#423|#425/i.test(t),
    );
  }

  // 1) Close with X → trigger regains focus; sheet stays open; inputs preserved
  {
    const sheet = await openBuySheet();
    await sheet.locator('input[type="number"]').first().fill("7");
    await sheet.getByRole("button", { name: /^limit$/i }).click();
    const limitInput = sheet.locator('input[type="number"]').nth(1);
    await limitInput.fill("130.5");
    const trigger = await openPickerFromSheet(sheet);

    // Only topmost dialog should be in the tab order meaningfully — picker open
    const picker = page.getByRole("dialog").filter({ hasText: "Choose portfolio" });
    await picker.getByRole("button", { name: "Close" }).click();

    await page.waitForFunction(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label")?.startsWith("Trading portfolio:") ?? false;
    });

    const focused = await page.evaluate(() => ({
      label: document.activeElement?.getAttribute("aria-label"),
      tag: document.activeElement?.tagName,
    }));
    console.log("after X close focus", focused);
    if (!focused.label?.startsWith("Trading portfolio:")) {
      ok = fail(`X close did not restore trigger focus: ${JSON.stringify(focused)}`) && ok;
    }

    if (!(await sheet.isVisible())) ok = fail("order sheet closed after picker X") && ok;
    const qty = await sheet.locator('input[type="number"]').first().inputValue();
    const limit = await sheet.locator('input[type="number"]').nth(1).inputValue();
    if (qty !== "7") ok = fail(`qty lost after X: ${qty}`) && ok;
    if (limit !== "130.5") ok = fail(`limit lost after X: ${limit}`) && ok;

    // trigger handle still the focused node
    const same = await trigger.evaluate((el) => el === document.activeElement);
    if (!same) ok = fail("focused element is not the portfolio trigger node") && ok;
  }

  // 2) Escape → trigger regains focus
  {
    const sheet = await openBuySheet();
    await openPickerFromSheet(sheet);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label")?.startsWith("Trading portfolio:") ?? false;
    });
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    );
    console.log("after Escape focus", focused);
    if (!focused?.startsWith("Trading portfolio:")) {
      ok = fail(`Escape did not restore trigger: ${focused}`) && ok;
    }
    if (!(await sheet.isVisible())) ok = fail("order sheet closed after Escape") && ok;
  }

  // 3) Select portfolio → updated trigger regains focus; sheet stays open
  {
    const sheet = await openBuySheet();
    await sheet.locator('input[type="number"]').first().fill("3");
    await openPickerFromSheet(sheet);
    const growth = page.getByRole("option", { name: /Growth Portfolio/i });
    if ((await growth.count()) > 0) await growth.click();
    else await page.locator('[role="option"]:not([aria-disabled="true"])').nth(1).click();
    await page.waitForURL(/portfolioId=/);

    await page.waitForFunction(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label")?.startsWith("Trading portfolio:") ?? false;
    });
    const focused = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    );
    console.log("after select focus", focused);
    if (!focused?.startsWith("Trading portfolio:")) {
      ok = fail(`select did not restore trigger: ${focused}`) && ok;
    }
    if (!(await sheet.isVisible())) ok = fail("order sheet closed after select") && ok;
    const qty = await sheet.locator('input[type="number"]').first().inputValue();
    if (qty !== "3") ok = fail(`qty lost after select: ${qty}`) && ok;
  }

  // 4) Nested: while picker open, order sheet trigger is not the active focus layer
  {
    const sheet = await openBuySheet();
    await openPickerFromSheet(sheet);
    const activeInPicker = await page.evaluate(() => {
      const active = document.activeElement;
      const picker = [...document.querySelectorAll('[role="dialog"]')].find((d) =>
        (d.textContent || "").includes("Choose portfolio"),
      );
      return Boolean(picker && active && picker.contains(active));
    });
    if (!activeInPicker) ok = fail("focus not inside topmost picker while open") && ok;
    await page.keyboard.press("Escape");
  }

  const hydra = hydrationHits();
  if (hydra.length) {
    ok = fail(`console hydration/focus issues: ${hydra.join(" | ")}`) && ok;
  } else {
    console.log("console clean (no hydration issues); other msgs:", consoleIssues.length);
  }

  await browser.close();
  if (!ok) {
    console.error("NESTED FOCUS FAIL");
    process.exit(1);
  }
  console.log("NESTED FOCUS ALL PASS");
})();
