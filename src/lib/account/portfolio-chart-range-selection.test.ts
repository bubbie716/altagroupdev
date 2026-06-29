import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChartBucketsForRange,
  findBucketContaining,
  resolveBucketHoverPoint,
  startOfLocalDay,
} from "./portfolio-chart-series.ts";
import {
  computeBucketSelectionMetrics,
  formatPortfolioChartSelectionRange,
  formatSelectionAmountLabel,
  formatSelectionPercentLabel,
  isSelectionVisible,
  normalizeBucketSelectionIndices,
  resolveBucketIndexAtPointer,
  selectionValuesStableWithinBucket,
} from "./portfolio-chart-range-selection.ts";

const NOW = new Date(2026, 5, 25, 15, 30, 0);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function dailySeries(days: number, startValue = 100_000, step = 1_000) {
  const points = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = startOfLocalDay(NOW);
    day.setDate(day.getDate() - offset);
    day.setHours(12, 0, 0, 0);
    const index = days - 1 - offset;
    points.push({ t: index, v: startValue + index * step, at: day.getTime() });
  }
  return points;
}

describe("portfolio chart drag selection", () => {
  it("starts and updates bucket indices from pointer timestamps", () => {
    const buckets = buildChartBucketsForRange(dailySeries(30), "1W", NOW);
    const startAt = buckets[10].startAt + 10 * 60 * 1000;
    const endAt = buckets[20].startAt + 10 * 60 * 1000;

    const startIndex = resolveBucketIndexAtPointer(buckets, startAt);
    const endIndex = resolveBucketIndexAtPointer(buckets, endAt);

    assert.equal(startIndex, 10);
    assert.equal(endIndex, 20);
    assert.equal(isSelectionVisible({ startIndex, endIndex, isDragging: true }), true);
  });

  it("uses bucket values for start and end performance", () => {
    const buckets = buildChartBucketsForRange(dailySeries(30), "1M", NOW);
    const metrics = computeBucketSelectionMetrics(buckets, 5, 12);
    assert.ok(metrics);
    assert.equal(metrics.startValue, buckets[5].v);
    assert.equal(metrics.endValue, buckets[12].v);
    assert.equal(metrics.absoluteChange, buckets[12].v - buckets[5].v);
  });

  it("calculates right-to-left drag from earlier bucket to later bucket", () => {
    const buckets = buildChartBucketsForRange(dailySeries(30), "1M", NOW);
    const metrics = computeBucketSelectionMetrics(buckets, 18, 6);
    assert.ok(metrics);
    assert.equal(metrics.startIndex, 6);
    assert.equal(metrics.endIndex, 18);
    assert.equal(metrics.startValue, buckets[6].v);
    assert.equal(metrics.endValue, buckets[18].v);
  });

  it("uses end value as percent basis when start value is zero", () => {
    const buckets = [
      { at: 0, startAt: 0, endAt: 1, v: 0 },
      { at: 2, startAt: 2, endAt: 3, v: 100 },
    ];
    const metrics = computeBucketSelectionMetrics(buckets, 0, 1);
    assert.ok(metrics);
    assert.equal(metrics.percentChange, 100);
    assert.equal(formatSelectionPercentLabel(metrics.percentChange), "+100.00%");
  });

  it("formats positive and negative performance labels", () => {
    assert.equal(formatSelectionAmountLabel(4832.91, (v) => `ƒ${v.toFixed(2)}`), "+ƒ4832.91");
    assert.equal(formatSelectionAmountLabel(-1200, (v) => `ƒ${v.toFixed(2)}`), "-ƒ1200.00");
    assert.equal(formatSelectionPercentLabel(2.47), "+2.47%");
    assert.equal(formatSelectionPercentLabel(-2.47), "-2.47%");
    assert.equal(formatSelectionPercentLabel(0), "0.00%");
  });

  it("does not interpolate inside the same bucket", () => {
    const buckets = buildChartBucketsForRange(dailySeries(30), "1W", NOW);
    const bucket = buckets[12];
    const samples = [bucket.startAt + 5 * 60 * 1000, bucket.endAt - 5 * 60 * 1000];
    assert.equal(selectionValuesStableWithinBucket(buckets, 12, samples), true);
    assert.equal(
      resolveBucketHoverPoint(buckets, samples[0]).v,
      resolveBucketHoverPoint(buckets, samples[1]).v,
    );
  });

  it("normalizes selection indices for overlay geometry", () => {
    const normalized = normalizeBucketSelectionIndices(14, 3);
    assert.deepEqual(normalized, { startIndex: 3, endIndex: 14 });
  });

  it("formats range labels per timeframe", () => {
    const dayStart = startOfLocalDay(NOW).getTime();
    const label1D = formatPortfolioChartSelectionRange(
      dayStart + 10 * HOUR_MS + 35 * 60 * 1000,
      dayStart + 14 * HOUR_MS + 45 * 60 * 1000,
      "1D",
    );
    assert.match(label1D, /\d{1,2}:\d{2} (AM|PM) – \d{1,2}:\d{2} (AM|PM)/);

    const buckets = buildChartBucketsForRange(dailySeries(120), "1M", NOW);
    const label1M = formatPortfolioChartSelectionRange(buckets[10].at, buckets[25].at, "1M");
    assert.match(label1M, /^[A-Za-z]{3} \d{1,2} – [A-Za-z]{3} \d{1,2}$/);

    const weekBuckets = buildChartBucketsForRange(dailySeries(366), "1Y", NOW);
    const label1Y = formatPortfolioChartSelectionRange(
      weekBuckets[10].at,
      weekBuckets[20].at,
      "1Y",
    );
    assert.match(label1Y, /^Week of /);

    const monthBuckets = buildChartBucketsForRange(dailySeries(366), "ALL", NOW);
    const labelAll = formatPortfolioChartSelectionRange(
      monthBuckets[0].at,
      monthBuckets[monthBuckets.length - 1].at,
      "ALL",
    );
    assert.match(labelAll, /^[A-Za-z]{3} \d{4} – [A-Za-z]{3} \d{4}$/);
  });

  it("maps pointer timestamps to containing buckets only", () => {
    const buckets = buildChartBucketsForRange(dailySeries(30), "1D", NOW);
    const sample = buckets[40].startAt + 60 * 1000;
    const index = resolveBucketIndexAtPointer(buckets, sample);
    assert.equal(findBucketContaining(buckets, sample), buckets[index]);
    assert.equal(buckets[index].v, resolveBucketHoverPoint(buckets, sample).v);
  });
});

describe("portfolio chart drag selection lifecycle", () => {
  it("single-bucket selection is not visible", () => {
    assert.equal(isSelectionVisible({ startIndex: 4, endIndex: 4, isDragging: false }), false);
  });

  it("clears when buckets change (simulates timeframe change)", () => {
    const first = buildChartBucketsForRange(dailySeries(30), "1W", NOW);
    const second = buildChartBucketsForRange(dailySeries(30), "1M", NOW);
    assert.notEqual(first.length, second.length);
  });
});
