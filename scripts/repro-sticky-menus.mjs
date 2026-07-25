import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function snap(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-radix-menu-content], [data-radix-select-content], [role="menu"], [role="listbox"]')];
    const details = nodes.map((el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        role: el.getAttribute('role'),
        state: el.getAttribute('data-state'),
        opacity: Number(s.opacity),
        pointerEvents: s.pointerEvents,
        visibility: s.visibility,
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent || '').slice(0, 50).replace(/\s+/g, ' '),
      };
    });
    const sticky = details.filter((d) =>
      d.pointerEvents !== 'none' &&
      d.opacity > 0.01 &&
      d.visibility !== 'hidden' &&
      d.w > 0 &&
      d.h > 0 &&
      d.state === 'closed'
    );
    const openVisible = details.filter((d) => d.state === 'open' && d.opacity > 0.01 && d.w > 0);
    return {
      expanded: document.querySelectorAll('[aria-expanded="true"]').length,
      nodes: details.length,
      stickyClosedVisible: sticky.length,
      openVisible: openVisible.length,
      details,
    };
  });
}

async function assertClean(page, label) {
  const results = [];
  for (const ms of [0, 16, 32, 50, 100]) {
    if (ms) await page.waitForTimeout(ms);
    try {
      results.push({ ms, ...(await snap(page)) });
    } catch (e) {
      results.push({ ms, error: String(e.message || e) });
    }
  }
  const bad = results.filter((r) => r.stickyClosedVisible > 0 || (r.expanded > 0 && r.ms >= 50));
  console.log(label, bad.length ? 'FAIL' : 'PASS', JSON.stringify(results[0]), '→', JSON.stringify(results[results.length - 1]));
  return bad.length === 0;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;

  async function run(viewport, name, fn) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(15000);
    try {
      const ok = await fn(page);
      if (!ok) allPass = false;
    } finally {
      await page.close();
    }
  }

  await run({ width: 1280, height: 800 }, 'desktop', async (page) => {
    let ok = true;
    await page.goto(`${BASE}/terminal/orders?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Portfolio switcher/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.getByRole('menuitem', { name: /Growth Portfolio/i }).click();
    ok = (await assertClean(page, 'DESKTOP portfolio')) && ok;

    await page.goto(`${BASE}/terminal?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Account/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.getByRole('menuitem', { name: /^Companies$/i }).click();
    ok = (await assertClean(page, 'DESKTOP account→companies')) && ok;

    await page.goto(`${BASE}/terminal?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Alta ecosystem/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.getByRole('menuitem', { name: /Alta Terminal/i }).click();
    ok = (await assertClean(page, 'DESKTOP ecosystem current')) && ok;

    // Keyboard: Account → Profile via Enter
    await page.goto(`${BASE}/terminal?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Account/i }).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    ok = (await assertClean(page, 'DESKTOP account keyboard')) && ok;

    // Space select
    await page.goto(`${BASE}/terminal/orders?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Portfolio switcher/i }).focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    ok = (await assertClean(page, 'DESKTOP portfolio Space')) && ok;

    return ok;
  });

  await run({ width: 390, height: 844 }, 'mobile', async (page) => {
    let ok = true;
    await page.goto(`${BASE}/terminal?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Account/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.getByRole('menuitem', { name: /^Profile$/i }).click();
    ok = (await assertClean(page, 'MOBILE account→profile')) && ok;

    await page.goto(`${BASE}/terminal/orders?site=terminal`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Portfolio switcher/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.getByRole('menuitem', { name: /Income Portfolio/i }).click();
    ok = (await assertClean(page, 'MOBILE portfolio')) && ok;

    // Dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${BASE}/terminal?site=terminal`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.getByRole('button', { name: /Account/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    await page.getByRole('menuitem', { name: /^Companies$/i }).click();
    ok = (await assertClean(page, 'MOBILE dark account')) && ok;

    return ok;
  });

  // Rapid double select should not duplicate
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${BASE}/terminal/orders?site=terminal`, { waitUntil: 'networkidle' });
    const navigations = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    await page.getByRole('button', { name: /Portfolio switcher/i }).click();
    await page.waitForSelector('[role="menu"][data-state="open"]');
    const item = page.getByRole('menuitem', { name: /Growth Portfolio/i });
    await Promise.all([item.click(), item.click().catch(() => {})]);
    await page.waitForTimeout(300);
    const clean = await assertClean(page, 'RAPID select');
    const uniq = [...new Set(navigations.filter((u) => u.includes('portfolioId=tp_ui-lab-user_growth')))];
    console.log('RAPID nav count to growth', uniq.length, uniq[0] || 'none');
    if (!clean || uniq.length > 1) allPass = false;
    await page.close();
  }

  await browser.close();
  if (!allPass) process.exit(1);
  console.log('\nALL BROWSER MENU CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
