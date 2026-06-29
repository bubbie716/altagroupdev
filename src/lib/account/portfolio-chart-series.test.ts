import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachPointDates,
  buildDisplaySeriesForRange,
  detectSeriesResolution,
  DISPLAY_INTERVAL_MS,
  formatPortfolioChartHoverDate,
  getPeriodBoundaryValues,
  getRangeWindow,
  localDayKey,
  resolveDisplayInterval,
  sliceSeriesForRange,
  snapHoverToSeries,
  snapPointerToDisplaySeries,
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

function assertFixedSpacing(points: { at?: number }[], intervalMs: number) {
  for (let index = 1; index < points.length - 1; index += 1) {
    assert.equal(points[index].at! - points[index - 1].at!, intervalMs);
  }
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

describe("portfolio chart display intervals", () => {
  it("1D uses 5-minute display steps", () => {
    const series = dailySeries(30);
    const display = buildDisplaySeriesForRange(series, "1D", NOW);
    const { startAt, endAt } = getRangeWindow("1D", series, NOW);
    assert.equal(resolveDisplayInterval("1D", series, startAt, endAt), FIVE_MIN_MS);
    assert.equal(display.length > 100, true);
    assertFixedSpacing(display, FIVE_MIN_MS);
  });

  it("1D daily source stays flat across 5-minute steps", () => {
    const series = dailySeries(30);
    const display = buildDisplaySeriesForRange(series, "1D", NOW);
    const uniqueValues = new Set(display.map((point) => point.v));
    assert.equal(uniqueValues.size, 1);
    assert.equal(display[0].v, stepValueAt(series, NOW.getTime()));
  });

  it("1W uses hourly display steps from daily source", () => {
    const series = dailySeries(30);
    const display = buildDisplaySeriesForRange(series, "1W", NOW);
    const { startAt, endAt } = getRangeWindow("1W", series, NOW);
    assert.equal(resolveDisplayInterval("1W", series, startAt, endAt), HOUR_MS);
    const expectedHours = Math.floor((endAt - startAt) / HOUR_MS);
    assert.equal(display.length >= expectedHours, true);
    assertFixedSpacing(display, HOUR_MS);
    assert.equal(detectSeriesResolution(series), "daily");
  });

  it("1M and 3M use daily display steps", () => {
    const series = dailySeries(120);
    const oneMonth = buildDisplaySeriesForRange(series, "1M", NOW);
    const threeMonth = buildDisplaySeriesForRange(series, "3M", NOW);
    const monthWindow = getRangeWindow("1M", series, NOW);
    const threeMonthWindow = getRangeWindow("3M", series, NOW);
    assert.equal(resolveDisplayInterval("1M", series, monthWindow.startAt, monthWindow.endAt), DAY_MS);
    assert.equal(
      resolveDisplayInterval("3M", series, threeMonthWindow.startAt, threeMonthWindow.endAt),
      DAY_MS,
    );
    assertFixedSpacing(oneMonth, DAY_MS);
    assertFixedSpacing(threeMonth, DAY_MS);
  });

  it("ALL uses calendar month buckets, not fixed 30-day steps", () => {
    const series = dailySeries(366);
    const display = buildDisplaySeriesForRange(series, "ALL", NOW);
    const monthKeys = display.map((point) => {
      const d = new Date(point.at!);
      return `${d.getFullYear()}-${d.getMonth()}`;
    });
    assert.equal(new Set(monthKeys).size, monthKeys.length);
    assert.equal(display.length >= 12, true);

    const gaps = display.slice(1).map((point, index) => point.at! - display[index].at!);
    assert.equal(gaps.every((gap) => gap === 30 * DAY_MS), false);
    assert.equal(new Set(gaps).size > 1, true);

    for (let index = 0; index < display.length - 1; index += 1) {
      const d = new Date(display[index].at!);
      const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      assert.equal(d.getDate(), lastDayOfMonth);
    }
  });

  it("1Y uses weekly for dense daily source and daily for sparse mock source", () => {
    const live = buildDisplaySeriesForRange(dailySeries(366), "1Y", NOW);
    const mock = buildDisplaySeriesForRange(
      attachPointDates(
        Array.from({ length: 180 }, (_, t) => ({ t, v: 10_000 + t * 50 })),
        NOW,
      ),
      "1Y",
      NOW,
    );
    const liveWindow = getRangeWindow("1Y", dailySeries(366), NOW);
    assert.equal(
      resolveDisplayInterval("1Y", dailySeries(366), liveWindow.startAt, liveWindow.endAt),
      "weekly",
    );
    assert.equal(live.length <= 54, true);
    assert.equal(live.length > 10, true);
    assert.equal(mock.length > 10, true);
    assertFixedSpacing(mock, DAY_MS);
  });
});

describe("portfolio chart hover snapping", () => {
  it("3M hover snaps to daily points without same-day value drift", () => {
    const series = dailySeries(120);
    const morning = startOfLocalDay(NOW);
    morning.setHours(9, 0, 0, 0);
    const afternoon = startOfLocalDay(NOW);
    afternoon.setHours(16, 0, 0, 0);

    const morningSnap = snapHoverToSeries(series, morning.getTime(), "day");
    const afternoonSnap = snapHoverToSeries(series, afternoon.getTime(), "day");

    assert.equal(morningSnap.v, afternoonSnap.v);
    assert.equal(localDayKey(morningSnap.at), localDayKey(afternoonSnap.at));
  });

  it("1D display scrub moves cursor time while value stays flat", () => {
    const series = dailySeries(30);
    const display = buildDisplaySeriesForRange(series, "1D", NOW);
    const morning = startOfLocalDay(NOW).getTime() + 2 * HOUR_MS;
    const afternoon = startOfLocalDay(NOW).getTime() + 8 * HOUR_MS;
    const morningSnap = snapPointerToDisplaySeries(display, morning);
    const afternoonSnap = snapPointerToDisplaySeries(display, afternoon);
    assert.notEqual(morningSnap.at, afternoonSnap.at);
    assert.equal(morningSnap.v, afternoonSnap.v);
  });

  it("1D daily tooltip shows scrub time on display grid", () => {
    const label = formatPortfolioChartHoverDate(NOW.getTime(), "1D", {
      resolution: "daily",
      snapMode: "day",
      now: NOW,
    });
    const expected = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(NOW);
    assert.equal(label, expected);
  });
});
