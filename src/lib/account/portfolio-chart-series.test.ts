import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertFixedBucketSpacing,
  attachPointDates,
  buildChartBucketsForRange,
  buildDisplaySeriesForRange,
  DISPLAY_INTERVAL_MS,
  formatPortfolioChartHoverDate,
  getPeriodBoundaryValues,
  getRangeWindow,
  hoverValuesWithinPeriod,
  localDayKey,
  localMonthKey,
  localWeekKey,
  resolveBucketHoverPoint,
  resolveDisplayLineValue,
  resolveDisplayInterval,
  sliceSeriesForRange,
  startOfLocalDay,
  stepValueAt,
} from "./portfolio-chart-series.ts";

const NOW = new Date(2026, 5, 25, 15, 30, 0);
const FIVE_MIN_MS = DISPLAY_INTERVAL_MS["1D"];
const HOUR_MS = DISPLAY_INTERVAL_MS["1W"];
const DAY_MS = DISPLAY_INTERVAL_MS["1M"];

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

function assertStableHover(
  buckets: ReturnType<typeof buildChartBucketsForRange>,
  samples: number[],
) {
  const values = hoverValuesWithinPeriod(buckets, samples);
  assert.equal(new Set(values).size, 1, `expected stable hover, got ${values.join(", ")}`);
}

function assertStableLabels(
  buckets: ReturnType<typeof buildChartBucketsForRange>,
  range: Parameters<typeof formatPortfolioChartHoverDate>[1],
  samples: number[],
) {
  const labels = samples.map(
    (at) => formatPortfolioChartHoverDate(resolveBucketHoverPoint(buckets, at).at, range),
  );
  assert.equal(new Set(labels).size, 1, `expected stable label, got ${labels.join(" | ")}`);
}

describe("portfolio chart range boundaries", () => {
  it("1D starts at local midnight, not noon", () => {
    const series = dailySeries(10);
    const { startAt, endAt } = getRangeWindow("1D", series, NOW);
    assert.equal(new Date(startAt).getHours(), 0);
    assert.equal(new Date(startAt).getMinutes(), 0);
    assert.equal(startAt < endAt, true);
    assert.equal(localDayKey(startAt), localDayKey(endAt));
  });

  it("P&L boundaries use the same window as slicing", () => {
    const series = dailySeries(90);
    const window = getRangeWindow("3M", series, NOW);
    const slice = sliceSeriesForRange(series, "3M", NOW);
    const bounds = getPeriodBoundaryValues(series, "3M", NOW);
    assert.equal(bounds.startAt, window.startAt);
    assert.equal(bounds.endAt, window.endAt);
    assert.equal(slice[0].at! >= window.startAt, true);
    assert.equal(slice[slice.length - 1].at! <= window.endAt, true);
  });
});

describe("portfolio chart bucket increments", () => {
  it("1D uses 5-minute buckets aligned from midnight", () => {
    const series = dailySeries(30);
    const buckets = buildChartBucketsForRange(series, "1D", NOW);
    const display = buildDisplaySeriesForRange(series, "1D", NOW);
    const { startAt, endAt } = getRangeWindow("1D", series, NOW);

    assert.equal(resolveDisplayInterval("1D"), FIVE_MIN_MS);
    assert.equal(buckets[0].startAt, startAt);
    assert.equal(buckets[buckets.length - 1].endAt, endAt);
    assert.equal(display[display.length - 1].at, endAt);
    assertFixedBucketSpacing(buckets, FIVE_MIN_MS);

    for (const bucket of buckets) {
      assert.equal(new Date(bucket.at).getMinutes() % 5, 0);
      assert.equal(new Date(bucket.at).getSeconds(), 0);
    }
  });

  it("1W uses hourly buckets across the last 7 days", () => {
    const series = dailySeries(30);
    const buckets = buildChartBucketsForRange(series, "1W", NOW);
    const { startAt, endAt } = getRangeWindow("1W", series, NOW);

    assert.equal(resolveDisplayInterval("1W"), HOUR_MS);
    assert.equal(buckets[0].startAt, startAt);
    assert.equal(buckets[buckets.length - 1].endAt, endAt);
    assertFixedBucketSpacing(buckets, HOUR_MS);

    for (const bucket of buckets) {
      assert.equal(new Date(bucket.at).getMinutes(), 0);
      assert.equal(new Date(bucket.at).getSeconds(), 0);
    }
  });

  it("1M and 3M use one calendar-day bucket per day", () => {
    const series = dailySeries(120);
    const oneMonth = buildChartBucketsForRange(series, "1M", NOW);
    const threeMonth = buildChartBucketsForRange(series, "3M", NOW);

    assert.equal(oneMonth.length, 30);
    assert.equal(threeMonth.length, 90);
    assert.equal(
      new Set(oneMonth.map((bucket) => localDayKey(bucket.startAt))).size,
      oneMonth.length,
    );
  });

  it("1Y uses calendar-week buckets", () => {
    const series = dailySeries(366);
    const buckets = buildChartBucketsForRange(series, "1Y", NOW);
    assert.equal(resolveDisplayInterval("1Y"), "weekly");
    assert.equal(buckets.length >= 52, true);
    assert.equal(new Set(buckets.map((b) => localWeekKey(b.startAt))).size, buckets.length);
  });

  it("ALL uses real calendar month buckets", () => {
    const series = dailySeries(366);
    const buckets = buildChartBucketsForRange(series, "ALL", NOW);
    assert.equal(resolveDisplayInterval("ALL"), "monthly");
    assert.equal(buckets.length >= 12, true);

    const monthKeys = buckets.map((bucket) => localMonthKey(bucket.startAt));
    assert.equal(new Set(monthKeys).size, monthKeys.length);

    for (const bucket of buckets) {
      assert.equal(new Date(bucket.startAt).getDate(), 1);
    }

    const gaps = buckets.slice(1).map((bucket, index) => bucket.startAt - buckets[index].startAt);
    assert.equal(gaps.every((gap) => gap === 30 * DAY_MS), false);
  });
});

describe("portfolio chart bucket hover stability", () => {
  it("1D value stays constant inside the same 5-minute bucket", () => {
    const series = dailySeries(30);
    const buckets = buildChartBucketsForRange(series, "1D", NOW);
    const bucket = buckets[Math.floor(buckets.length / 2)];
    const early = bucket.startAt + 60 * 1000;
    const late = bucket.endAt - 60 * 1000;

    assertStableHover(buckets, [early, late]);
    assertStableLabels(buckets, "1D", [early, late]);
  });

  it("1W value stays constant inside the same hourly bucket", () => {
    const series = dailySeries(30);
    const buckets = buildChartBucketsForRange(series, "1W", NOW);
    const bucket = buckets[50];
    const early = bucket.startAt + 5 * 60 * 1000;
    const late = bucket.endAt - 5 * 60 * 1000;

    assertStableHover(buckets, [early, late]);
    assertStableLabels(buckets, "1W", [early, late]);
  });

  it("1M value stays constant inside the same displayed day", () => {
    const series = dailySeries(120);
    const buckets = buildChartBucketsForRange(series, "1M", NOW);
    const today = startOfLocalDay(NOW);
    const morning = today.getTime() + 9 * HOUR_MS;
    const afternoon = today.getTime() + 16 * HOUR_MS;

    assertStableHover(buckets, [morning, afternoon]);
    assertStableLabels(buckets, "1M", [morning, afternoon]);
  });

  it("3M value stays constant inside the same displayed day", () => {
    const series = dailySeries(120);
    const buckets = buildChartBucketsForRange(series, "3M", NOW);
    const day = startOfLocalDay(NOW);
    day.setDate(day.getDate() - 10);
    assertStableHover(buckets, [day.getTime() + 8 * HOUR_MS, day.getTime() + 20 * HOUR_MS]);
    assertStableLabels(buckets, "3M", [day.getTime() + 8 * HOUR_MS, day.getTime() + 20 * HOUR_MS]);
  });

  it("1Y value stays constant inside the same displayed week", () => {
    const series = dailySeries(366);
    const buckets = buildChartBucketsForRange(series, "1Y", NOW);
    const weekKey = localWeekKey(NOW.getTime());
    const weekBucket = buckets.find((bucket) => localWeekKey(bucket.startAt) === weekKey);
    assert.ok(weekBucket);

    const early = weekBucket.startAt + DAY_MS;
    const late = weekBucket.endAt - HOUR_MS;
    assertStableHover(buckets, [early, late]);
    assertStableLabels(buckets, "1Y", [early, late]);
  });

  it("ALL value stays constant inside the same displayed month", () => {
    const series = dailySeries(366);
    const buckets = buildChartBucketsForRange(series, "ALL", NOW);
    const monthKey = localMonthKey(NOW.getTime());
    const monthBucket = buckets.find((bucket) => localMonthKey(bucket.startAt) === monthKey);
    assert.ok(monthBucket);

    const early = monthBucket.startAt + 3 * DAY_MS;
    const late = monthBucket.endAt - DAY_MS;
    assertStableHover(buckets, [early, late]);
    assertStableLabels(buckets, "ALL", [early, late]);
  });

  it("values only change at bucket boundaries (carry-forward, no interpolation)", () => {
    const series = dailySeries(30);
    const buckets = buildChartBucketsForRange(series, "1W", NOW);

    for (const bucket of buckets) {
      const beforeEnd = bucket.endAt - 1;
      const atStart = resolveBucketHoverPoint(buckets, bucket.startAt + 1);
      const beforeBoundary = resolveBucketHoverPoint(buckets, beforeEnd);
      assert.equal(atStart.v, beforeBoundary.v);
      assert.equal(atStart.at, beforeBoundary.at);
    }
  });

  it("3M ignores live current value on the display line", () => {
    const series = dailySeries(120);
    const baseline = buildDisplaySeriesForRange(series, "3M", NOW);
    const withLive = buildDisplaySeriesForRange(
      series,
      "3M",
      NOW,
      series[series.length - 1]!.v + 500,
    );
    assert.deepEqual(
      baseline.map((point) => ({ at: point.at, v: point.v })),
      withLive.map((point) => ({ at: point.at, v: point.v })),
    );
  });
});

describe("portfolio chart tooltip labels", () => {
  it("formats 1D as time only (e.g. 10:35 AM)", () => {
    const at = startOfLocalDay(NOW).getTime() + 10 * HOUR_MS + 35 * 60 * 1000;
    const label = formatPortfolioChartHoverDate(at, "1D");
    assert.match(label, /\d{1,2}:\d{2} (AM|PM)/);
    assert.equal(label.includes(","), false);
  });

  it("formats 1W as weekday and time (e.g. Tue 2:00 PM)", () => {
    const at = startOfLocalDay(NOW).getTime() + 14 * HOUR_MS;
    const label = formatPortfolioChartHoverDate(at, "1W");
    assert.match(label, /^[A-Za-z]{3} \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("formats 1M and 3M as month and day (e.g. Jun 28)", () => {
    const label = formatPortfolioChartHoverDate(NOW.getTime(), "1M");
    assert.match(label, /^[A-Za-z]{3} \d{1,2}$/);
    assert.equal(formatPortfolioChartHoverDate(NOW.getTime(), "3M"), label);
  });

  it("formats 1Y as Week of …", () => {
    const label = formatPortfolioChartHoverDate(NOW.getTime(), "1Y");
    assert.match(label, /^Week of [A-Za-z]{3} \d{1,2}$/);
  });

  it("formats ALL as month and year (e.g. Jun 2026)", () => {
    const label = formatPortfolioChartHoverDate(NOW.getTime(), "ALL");
    assert.match(label, /^[A-Za-z]{3} \d{4}$/);
  });

  it("1D bucket label matches bucket anchor time", () => {
    const series = dailySeries(30);
    const buckets = buildChartBucketsForRange(series, "1D", NOW);
    const bucket = buckets.find((b) => b.startAt === startOfLocalDay(NOW).getTime() + 10 * HOUR_MS + 35 * 60 * 1000);
    assert.ok(bucket);
    const hover = resolveBucketHoverPoint(buckets, bucket.startAt + 2 * 60 * 1000);
    assert.equal(formatPortfolioChartHoverDate(hover.at, "1D"), formatPortfolioChartHoverDate(bucket.at, "1D"));
  });
});

describe("portfolio chart hover geometry", () => {
  it("display line value matches stepAfter semantics at pointer time", () => {
    const series = dailySeries(30);
    const display = buildDisplaySeriesForRange(series, "1W", NOW);
    const buckets = buildChartBucketsForRange(series, "1W", NOW);
    const pointerAt = buckets[10].startAt + 20 * 60 * 1000;
    const bucket = resolveBucketHoverPoint(buckets, pointerAt);
    assert.equal(resolveDisplayLineValue(display, pointerAt), bucket.v);
  });
});

describe("portfolio chart carry-forward", () => {
  it("empty buckets carry forward the last known value without fake movement", () => {
    const series = dailySeries(30).slice(0, -1);
    const buckets = buildChartBucketsForRange(series, "1D", NOW, stepValueAt(series, NOW.getTime()));
    const dayStart = startOfLocalDay(NOW).getTime();
    const expectedOpen = stepValueAt(series, dayStart);

    assert.equal(buckets.every((b) => b.v === expectedOpen), true);
  });
});
