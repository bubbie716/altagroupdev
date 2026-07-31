import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cryptoMarkedValueAt,
  mergeCryptoIntoPortfolioHistory,
  quantityHeldAt,
  resolveCryptoUnitPriceAt,
  slicePortfolioHistoryForRange,
} from "./crypto-portfolio-history";

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("crypto portfolio history — no crypto before first fill", () => {
  it("contributes nothing before the first applicable fill", () => {
    const fillAt = 1_000_000;
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [
        { t: fillAt - 2 * HOUR, v: 100 },
        { t: fillAt - HOUR, v: 110 },
        { t: fillAt + HOUR, v: 120 },
      ],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 10,
          executedAtMs: fillAt,
          executionPrice: 5,
        },
      ],
      assets: [
        {
          symbol: "NVA",
          candles: [
            { t: fillAt - HOUR, close: 5 },
            { t: fillAt, close: 5.1 },
          ],
        },
      ],
      nowMs: fillAt + HOUR,
    });

    assert.equal(result.firstCryptoFillAtMs, fillAt);
    assert.equal(result.cryptoContributed, true);
    const before = result.series.filter((p) => p.t < fillAt);
    assert.ok(before.length >= 1);
    for (const p of before) {
      assert.equal(p.v, p.t === fillAt - 2 * HOUR ? 100 : 110);
    }
    const atFill = result.series.find((p) => p.t === fillAt);
    assert.ok(atFill);
    // Base carries 110 (last stock/cash point at or before fill); crypto adds 10 × 5.1.
    assert.equal(atFill.v, 110 + 10 * 5.1);
  });

  it("cryptoMarkedValueAt is zero before first fill", () => {
    const fillAt = 5_000;
    assert.equal(
      cryptoMarkedValueAt({
        atMs: fillAt - 1,
        fills: [
          {
            symbol: "NVA",
            side: "BUY",
            quantity: 2,
            executedAtMs: fillAt,
            executionPrice: 5,
          },
        ],
        assets: [{ symbol: "NVA", candles: [{ t: fillAt, close: 5 }] }],
        firstCryptoFillAtMs: fillAt,
      }),
      0,
    );
  });
});

describe("crypto portfolio history — buy increases exposure", () => {
  it("buy increases crypto exposure at execution time", () => {
    const t0 = 10_000;
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [
        { t: t0, v: 200 },
        { t: t0 + HOUR, v: 200 },
      ],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 4,
          executedAtMs: t0 + 30 * 60_000,
          executionPrice: 5,
        },
      ],
      assets: [
        {
          symbol: "NVA",
          candles: [{ t: t0 + 30 * 60_000, close: 5 }],
        },
      ],
      nowMs: t0 + HOUR,
    });

    const mid = result.series.find((p) => p.t === t0 + 30 * 60_000);
    assert.ok(mid);
    assert.equal(mid.v, 200 + 4 * 5);
    const end = result.series.find((p) => p.t === t0 + HOUR);
    assert.ok(end);
    assert.equal(end.v, 200 + 4 * 5);
  });
});

describe("crypto portfolio history — sell reduces/removes", () => {
  it("sell reduces quantity from execution time forward", () => {
    const t0 = 20_000;
    const buyAt = t0;
    const sellAt = t0 + HOUR;
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [{ t: t0, v: 50 }],
      fills: [
        {
          symbol: "VLT",
          side: "BUY",
          quantity: 10,
          executedAtMs: buyAt,
          executionPrice: 1,
        },
        {
          symbol: "VLT",
          side: "SELL",
          quantity: 4,
          executedAtMs: sellAt,
          executionPrice: 1.2,
        },
      ],
      assets: [
        {
          symbol: "VLT",
          candles: [
            { t: buyAt, close: 1 },
            { t: sellAt, close: 1.2 },
          ],
        },
      ],
      nowMs: sellAt + HOUR,
      cashBaseline: 50,
    });

    const fills = [
      {
        symbol: "VLT",
        side: "BUY" as const,
        quantity: 10,
        executedAtMs: buyAt,
        executionPrice: 1,
      },
      {
        symbol: "VLT",
        side: "SELL" as const,
        quantity: 4,
        executedAtMs: sellAt,
        executionPrice: 1.2,
      },
    ];
    assert.equal(quantityHeldAt(fills, "VLT", sellAt - 1), 10);
    assert.equal(quantityHeldAt(fills, "VLT", sellAt), 6);

    const afterSell = result.series.find((p) => p.t === sellAt);
    assert.ok(afterSell);
    assert.equal(afterSell.v, 50 + 6 * 1.2);
  });

  it("full sell removes crypto exposure", () => {
    const buyAt = 1_000;
    const sellAt = 2_000;
    const fills = [
      {
        symbol: "NVA" as const,
        side: "BUY" as const,
        quantity: 3,
        executedAtMs: buyAt,
        executionPrice: 5,
      },
      {
        symbol: "NVA" as const,
        side: "SELL" as const,
        quantity: 3,
        executedAtMs: sellAt,
        executionPrice: 5.5,
      },
    ];
    assert.equal(quantityHeldAt(fills, "NVA", sellAt), 0);
    const marked = cryptoMarkedValueAt({
      atMs: sellAt,
      fills,
      assets: [{ symbol: "NVA", candles: [{ t: sellAt, close: 5.5 }] }],
      firstCryptoFillAtMs: buyAt,
    });
    assert.equal(marked, 0);
  });
});

describe("crypto portfolio history — multiple assets", () => {
  it("values multiple assets independently", () => {
    const t0 = 100_000;
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [{ t: t0, v: 1_000 }],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 2,
          executedAtMs: t0,
          executionPrice: 5,
        },
        {
          symbol: "VLT",
          side: "BUY",
          quantity: 10,
          executedAtMs: t0 + 1_000,
          executionPrice: 1,
        },
      ],
      assets: [
        { symbol: "NVA", candles: [{ t: t0, close: 5 }] },
        { symbol: "VLT", candles: [{ t: t0 + 1_000, close: 1 }] },
      ],
      nowMs: t0 + 2_000,
    });

    const end = result.series[result.series.length - 1]!;
    assert.equal(end.v, 1_000 + 2 * 5 + 10 * 1);
  });
});

describe("crypto portfolio history — NPFC peg", () => {
  it("values NPFC at ƒ1 regardless of candle closes", () => {
    const t0 = 50_000;
    assert.equal(
      resolveCryptoUnitPriceAt({
        symbol: "NPFC",
        atMs: t0 + DAY,
        assets: [
          {
            symbol: "NPFC",
            pegPrice: 1,
            candles: [{ t: t0, close: 0.97 }],
          },
        ],
        fills: [],
      }),
      1,
    );

    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [{ t: t0, v: 0 }],
      fills: [
        {
          symbol: "NPFC",
          side: "BUY",
          quantity: 25,
          executedAtMs: t0,
          executionPrice: 1,
        },
      ],
      assets: [
        {
          symbol: "NPFC",
          pegPrice: 1,
          candles: [{ t: t0, close: 0.5 }],
        },
      ],
      nowMs: t0 + HOUR,
      cashBaseline: 0,
    });

    const end = result.series[result.series.length - 1]!;
    assert.equal(end.v, 25);
  });
});

describe("crypto portfolio history — missing candle history", () => {
  it("falls back to last known executed price when candles are missing", () => {
    const t0 = 70_000;
    const price = resolveCryptoUnitPriceAt({
      symbol: "NVA",
      atMs: t0 + HOUR,
      assets: [{ symbol: "NVA", candles: [] }],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 1,
          executedAtMs: t0,
          executionPrice: 5.25,
        },
      ],
    });
    assert.equal(price, 5.25);

    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [{ t: t0, v: 10 }],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 2,
          executedAtMs: t0,
          executionPrice: 5.25,
        },
      ],
      assets: [{ symbol: "NVA", candles: [] }],
      nowMs: t0 + HOUR,
    });

    const end = result.series[result.series.length - 1]!;
    assert.equal(end.v, 10 + 2 * 5.25);
  });

  it("carries last known real close flat between traded periods", () => {
    const t0 = 80_000;
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [{ t: t0, v: 0 }],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 1,
          executedAtMs: t0,
          executionPrice: 5,
        },
      ],
      assets: [
        {
          symbol: "NVA",
          candles: [{ t: t0, close: 5 }],
        },
      ],
      nowMs: t0 + 3 * HOUR,
      cashBaseline: 0,
    });

    // Later timeline points with no new candles keep the same mark (flat continuation).
    const values = result.series.filter((p) => p.t >= t0).map((p) => p.v);
    assert.ok(values.length >= 2);
    assert.ok(values.every((v) => v === 5));
  });
});

describe("crypto portfolio history — no double-counting current value", () => {
  it("applies currentCryptoMarkedValue once at the series end", () => {
    const t0 = 90_000;
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [
        { t: t0, v: 100 },
        { t: t0 + HOUR, v: 100 },
      ],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 10,
          executedAtMs: t0,
          executionPrice: 5,
        },
      ],
      assets: [
        {
          symbol: "NVA",
          // Stale candle would mark 10*5=50; live mark is 55 — apply once, not 50+55.
          candles: [{ t: t0, close: 5 }],
        },
      ],
      currentCryptoMarkedValue: 55,
      nowMs: t0 + HOUR,
    });

    const end = result.series[result.series.length - 1]!;
    assert.equal(end.v, 100 + 55);
    // Midpoint still uses candle-derived mark (not live + candle).
    const mid = result.series.find((p) => p.t === t0);
    assert.ok(mid);
    assert.equal(mid.v, 100 + 50);
  });
});

describe("crypto portfolio history — preserves stock/cash base", () => {
  it("preserves base series values when there are no fills", () => {
    const base = [
      { t: 1, v: 10 },
      { t: 2, v: 20 },
    ];
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: base,
      fills: [],
      assets: [],
    });
    assert.deepEqual(result.series, base);
    assert.equal(result.cryptoContributed, false);
  });

  it("labels narrower scope when base history is empty", () => {
    const result = mergeCryptoIntoPortfolioHistory({
      baseSeries: [],
      fills: [
        {
          symbol: "NVA",
          side: "BUY",
          quantity: 1,
          executedAtMs: 1_000,
          executionPrice: 5,
        },
      ],
      assets: [{ symbol: "NVA", candles: [{ t: 1_000, close: 5 }] }],
      nowMs: 2_000,
      cashBaseline: 0,
    });
    assert.equal(result.cryptoContributed, true);
    assert.match(result.scopeNote ?? "", /crypto fills and prices only/i);
  });
});

describe("slicePortfolioHistoryForRange", () => {
  it("does not invent points before the first real observation", () => {
    const series = [
      { t: 10_000, v: 5 },
      { t: 20_000, v: 8 },
    ];
    const sliced = slicePortfolioHistoryForRange(series, 0, 20_000);
    assert.equal(sliced[0]?.t, 10_000);
    assert.equal(sliced[0]?.v, 5);
  });
});
