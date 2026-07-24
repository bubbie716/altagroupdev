import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCompactVolume,
  formatMarketCap,
  formatTerminalMoney,
  formatTerminalPercent,
  formatTerminalPrice,
} from "@/lib/terminal/format";
import { estimateOrderValue, validateOrderPreview } from "@/lib/terminal/order-validation";
import { filterOrders, filterSecurities, sortSecurities } from "@/lib/terminal/market-filters";
import { MockTseClient } from "@/lib/terminal/mock-tse-client";
import { UnavailableTseClient } from "@/lib/terminal/unavailable-tse-client";
import {
  createTseClient,
  getTseClient,
  resetTseClientForTests,
  resolveTerminalTseMode,
} from "@/lib/terminal/tse-client";
import { getFixtureSecurity, listFixtureSecurities } from "@/lib/terminal/terminal-fixtures";

describe("terminal format", () => {
  it("formats money and signed variants", () => {
    assert.equal(formatTerminalMoney(1234.5), "ƒ1,234.50");
    assert.equal(formatTerminalMoney(-12.3, { signed: true }), "-ƒ12.30");
    assert.equal(formatTerminalMoney(12.3, { signed: true }), "+ƒ12.30");
  });

  it("formats percent with sign", () => {
    assert.equal(formatTerminalPercent(2.5), "+2.50%");
    assert.equal(formatTerminalPercent(-1.25), "-1.25%");
  });

  it("formats price and volume", () => {
    assert.equal(formatTerminalPrice(18.72), "ƒ18.72");
    assert.equal(formatCompactVolume(1_842_300), "1.84M");
    assert.equal(formatMarketCap(null), "—");
  });
});

describe("terminal market filters", () => {
  const rows = listFixtureSecurities();

  it("filters by query and gainers/losers", () => {
    const alta = filterSecurities(rows, { query: "alta" });
    assert.equal(alta.length, 1);
    assert.equal(alta[0]?.symbol, "ALTA");
    assert.ok(filterSecurities(rows, { filter: "gainers" }).every((r) => r.dayChangePercent > 0));
    assert.ok(filterSecurities(rows, { filter: "losers" }).every((r) => r.dayChangePercent < 0));
  });

  it("sorts by day change", () => {
    const sorted = sortSecurities(rows, "dayChangePercent", "desc");
    assert.ok((sorted[0]?.dayChangePercent ?? 0) >= (sorted[1]?.dayChangePercent ?? 0));
  });

  it("filters orders", () => {
    const orders = [
      { status: "open" as const, side: "buy" as const },
      { status: "filled" as const, side: "sell" as const },
    ];
    assert.equal(filterOrders(orders, { status: "open" }).length, 1);
    assert.equal(filterOrders(orders, { side: "sell" }).length, 1);
  });
});

describe("terminal order validation", () => {
  const security = getFixtureSecurity("ALTA")!;

  it("estimates order value", () => {
    const est = estimateOrderValue(10, 100);
    assert.equal(est.estimatedValue, 1000);
    assert.equal(est.estimatedFees, 1);
  });

  it("rejects halted securities and insufficient buying power", () => {
    const halted = getFixtureSecurity("HALT")!;
    const haltedPreview = validateOrderPreview({
      order: { symbol: "HALT", side: "buy", type: "market", quantity: 1 },
      security: halted,
      marketStatus: "open",
      buyingPower: 10_000,
      holding: null,
    });
    assert.equal(haltedPreview.ok, false);
    assert.ok(haltedPreview.errors.some((e) => /halted/i.test(e)));

    const poor = validateOrderPreview({
      order: { symbol: "ALTA", side: "buy", type: "market", quantity: 1000 },
      security,
      marketStatus: "open",
      buyingPower: 10,
      holding: null,
    });
    assert.equal(poor.ok, false);
    assert.ok(poor.errors.some((e) => /buying power/i.test(e)));
  });

  it("accepts a valid market buy", () => {
    const preview = validateOrderPreview({
      order: { symbol: "ALTA", side: "buy", type: "market", quantity: 1 },
      security,
      marketStatus: "open",
      buyingPower: 10_000,
      holding: null,
    });
    assert.equal(preview.ok, true);
    assert.ok(preview.estimatedValue > 0);
  });
});

describe("terminal tse clients", () => {
  it("mock client returns deterministic securities and can submit demo orders", async () => {
    const client = new MockTseClient();
    const list = await client.listSecurities();
    assert.ok(list.length >= 5);
    const again = await client.listSecurities();
    assert.deepEqual(list, again);

    const preview = await client.previewOrder({
      symbol: "MINE",
      side: "buy",
      type: "market",
      quantity: 1,
    });
    assert.equal(preview.ok, true);

    const submitted = await client.submitOrder({
      symbol: "MINE",
      side: "buy",
      type: "limit",
      quantity: 1,
      limitPrice: 18,
    });
    assert.equal(submitted.ok, true);
    if (submitted.ok) assert.equal(submitted.order.status, "open");
  });

  it("unavailable client disables trading", async () => {
    const client = new UnavailableTseClient();
    assert.equal(client.mode, "unavailable");
    const submit = await client.submitOrder({
      symbol: "ALTA",
      side: "buy",
      type: "market",
      quantity: 1,
    });
    assert.equal(submit.ok, false);
    if (!submit.ok) assert.equal(submit.code, "unavailable");
    assert.equal((await client.listSecurities()).length, 0);
  });

  it("factory respects explicit mock mode", () => {
    resetTseClientForTests();
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "mock";
    assert.equal(resolveTerminalTseMode(), "mock");
    const client = createTseClient();
    assert.equal(client.mode, "mock");
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });

  it("factory uses unavailable for explicit unavailable mode", () => {
    resetTseClientForTests();
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "unavailable";
    assert.equal(createTseClient().mode, "unavailable");
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });

  it("isolates mutable mock state by authenticated user", async () => {
    resetTseClientForTests();
    const prev = process.env.TERMINAL_TSE_MODE;
    process.env.TERMINAL_TSE_MODE = "mock";
    const first = getTseClient({ userId: "terminal-user-one" });
    const second = getTseClient({ userId: "terminal-user-two" });

    await first.addToWatchlist("ALTA");

    assert.equal(
      (await first.getWatchlist()).some((item) => item.symbol === "ALTA"),
      true,
    );
    assert.equal(
      (await second.getWatchlist()).some((item) => item.symbol === "ALTA"),
      false,
    );
    process.env.TERMINAL_TSE_MODE = prev;
    resetTseClientForTests();
  });
});
