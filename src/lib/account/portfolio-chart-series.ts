export type PortfolioChartPoint = {
  t: string | number;
  v: number;
  at?: number;
};

export type PortfolioTimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type SeriesResolution = "intraday" | "daily";

/** @deprecated Bucket hover replaces snap modes. */
export type HoverSnapMode = "continuous" | "day" | "week" | "month";

export type PortfolioChartBucket = {
  /** Anchor timestamp for chart placement and tooltip label. */
  at: number;
  startAt: number;
  endAt: number;
  v: number;
};

export const PORTFOLIO_CHART_MARGIN = { top: 4, right: 4, bottom: 4, left: 4 };

export const PORTFOLIO_RANGE_DAYS: Record<Exclude<PortfolioTimeRange, "1D" | "ALL">, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
};

export const CHART_HISTORY_DAYS = 365;

const PERCENT_BASIS_EPSILON = 0.01;

const NY_TIMEZONE = "America/New_York";

const MINUTE_MS = 60 * 1000;
const FIVE_MIN_MS = 5 * MINUTE_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const INTRADAY_GAP_MS = 20 * HOUR_MS;

export const DISPLAY_INTERVAL_MS: Record<
  Exclude<PortfolioTimeRange, "1Y" | "ALL">,
  number
> = {
  "1D": FIVE_MIN_MS,
  "1W": HOUR_MS,
  "1M": DAY_MS,
  "3M": DAY_MS,
};

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function localDayKey(atMs: number): string {
  const date = new Date(atMs);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function localMonthKey(atMs: number): string {
  const date = new Date(atMs);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function localWeekKey(atMs: number): string {
  return localDayKey(startOfLocalWeek(new Date(atMs)).getTime());
}

export function ensureSortedSeries(points: PortfolioChartPoint[]): PortfolioChartPoint[] {
  return [...points]
    .map((point) => ({
      ...point,
      v: typeof point.v === "number" ? point.v : Number(point.v),
    }))
    .filter((point) => point.at != null && Number.isFinite(point.v))
    .sort((a, b) => a.at! - b.at!);
}

export function dedupeTimestamps(points: PortfolioChartPoint[]): PortfolioChartPoint[] {
  if (points.length === 0) return points;

  const byTime = new Map<number, PortfolioChartPoint>();
  for (const point of points) {
    byTime.set(point.at!, point);
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, point]) => point);
}

export function attachPointDates(
  data: PortfolioChartPoint[],
  now: Date = new Date(),
): PortfolioChartPoint[] {
  const totalPoints = data.length;
  return data.map((point) => {
    if (point.at != null) return point;
    const index = typeof point.t === "number" ? point.t : 0;
    return { ...point, at: chartPointDate(index, totalPoints, now).getTime() };
  });
}

function chartPointDate(pointIndex: number, totalPoints: number, now: Date): Date {
  if (totalPoints <= 1) return startOfLocalDay(now);

  const daysPerStep = CHART_HISTORY_DAYS / (totalPoints - 1);
  const daysFromEnd = (totalPoints - 1 - pointIndex) * daysPerStep;
  const date = startOfLocalDay(now);
  date.setDate(date.getDate() - Math.round(daysFromEnd));
  return date;
}

export function detectSeriesResolution(points: PortfolioChartPoint[]): SeriesResolution {
  const sorted = ensureSortedSeries(points);
  if (sorted.length < 2) return "daily";

  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].at! - sorted[i - 1].at!;
    if (gap < INTRADAY_GAP_MS) return "intraday";
  }
  return "daily";
}

export function getHoverSnapMode(
  range: PortfolioTimeRange,
  _resolution: SeriesResolution,
): HoverSnapMode {
  if (range === "1Y") return "week";
  if (range === "ALL") return "month";
  if (range === "1D") return "continuous";
  return "day";
}

export function getChartLineType(
  _range: PortfolioTimeRange,
  _resolution: SeriesResolution,
): "linear" | "stepAfter" {
  return "stepAfter";
}

/** 1D: midnight today → now. Others: calendar lookback → now. ALL: first source → now. */
export function getRangeWindow(
  range: PortfolioTimeRange,
  sorted: PortfolioChartPoint[],
  now: Date = new Date(),
): { startAt: number; endAt: number } {
  const endAt = now.getTime();

  if (range === "ALL") {
    if (sorted.length === 0) return { startAt: endAt, endAt };
    const lastAt = sorted[sorted.length - 1].at!;
    return { startAt: sorted[0].at!, endAt: Math.max(lastAt, endAt) };
  }

  if (range === "1D") {
    return { startAt: startOfLocalDay(now).getTime(), endAt };
  }

  const lookbackDays = PORTFOLIO_RANGE_DAYS[range];
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - (lookbackDays - 1));
  return { startAt: start.getTime(), endAt };
}

export function findLastPointAtOrBefore(
  sorted: PortfolioChartPoint[],
  atMs: number,
): PortfolioChartPoint | null {
  if (sorted.length === 0) return null;

  let result: PortfolioChartPoint | null = null;
  for (const point of sorted) {
    if (point.at! <= atMs) result = point;
    else break;
  }
  return result ?? sorted[0];
}

/** Carry-forward balance: last known value at or before `atMs`. */
export function stepValueAt(sorted: PortfolioChartPoint[], atMs: number): number {
  if (sorted.length === 0) return 0;
  const point = findLastPointAtOrBefore(sorted, atMs);
  return point?.v ?? sorted[0].v;
}

export function resolvePeriodEndValue(
  sorted: PortfolioChartPoint[],
  endAt: number,
  currentValue?: number,
): number {
  if (currentValue != null && Number.isFinite(currentValue)) {
    return currentValue;
  }
  return stepValueAt(sorted, endAt);
}

function endOfLocalDayMs(dayStartMs: number): number {
  const end = startOfLocalDay(new Date(dayStartMs));
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

export function startOfLocalWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function endOfLocalWeekMs(weekStartMs: number): number {
  const end = startOfLocalWeek(new Date(weekStartMs));
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function bucketValueAt(
  sorted: PortfolioChartPoint[],
  bucketEnd: number,
  isLastBucket: boolean,
  liveEndValue?: number,
): number {
  if (isLastBucket && liveEndValue != null && Number.isFinite(liveEndValue)) {
    return liveEndValue;
  }
  return stepValueAt(sorted, bucketEnd);
}

/** Fixed-width buckets aligned from range start — value carry-forwards via stepValueAt. */
function buildFixedIntervalBuckets(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
  intervalMs: number,
  liveEndValue?: number,
): PortfolioChartBucket[] {
  if (endAt <= startAt || intervalMs <= 0) return [];

  const buckets: PortfolioChartBucket[] = [];
  let bucketStart = startAt;

  while (bucketStart < endAt) {
    const bucketEnd = Math.min(bucketStart + intervalMs, endAt);
    const isLast = bucketEnd >= endAt;
    buckets.push({
      at: bucketStart,
      startAt: bucketStart,
      endAt: bucketEnd,
      v: bucketValueAt(sorted, bucketEnd, isLast, liveEndValue),
    });
    bucketStart += intervalMs;
  }

  return buckets;
}

function buildCalendarDayBuckets(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
): PortfolioChartBucket[] {
  const buckets: PortfolioChartBucket[] = [];
  const cursor = startOfLocalDay(new Date(startAt));
  const lastDay = startOfLocalDay(new Date(endAt));

  while (cursor.getTime() <= lastDay.getTime()) {
    const dayStart = cursor.getTime();
    const dayEnd = Math.min(endOfLocalDayMs(dayStart), endAt);
    buckets.push({
      at: dayStart,
      startAt: dayStart,
      endAt: dayEnd,
      v: stepValueAt(sorted, dayEnd),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function buildCalendarWeekBuckets(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
): PortfolioChartBucket[] {
  const buckets: PortfolioChartBucket[] = [];
  let cursor = startOfLocalWeek(new Date(startAt));

  while (cursor.getTime() <= endAt) {
    const weekStart = cursor.getTime();
    const weekEnd = Math.min(endOfLocalWeekMs(weekStart), endAt);
    buckets.push({
      at: weekStart,
      startAt: weekStart,
      endAt: weekEnd,
      v: stepValueAt(sorted, weekEnd),
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  return buckets;
}

function buildCalendarMonthBuckets(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
): PortfolioChartBucket[] {
  const buckets: PortfolioChartBucket[] = [];
  const cursor = startOfLocalDay(new Date(startAt));
  cursor.setDate(1);

  while (cursor.getTime() <= endAt) {
    const monthStart = cursor.getTime();
    const monthEndDate = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthEnd = Math.min(monthEndDate.getTime(), endAt);
    buckets.push({
      at: monthStart,
      startAt: monthStart,
      endAt: monthEnd,
      v: stepValueAt(sorted, monthEnd),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

export function resolveDisplayInterval(
  range: PortfolioTimeRange,
): number | "weekly" | "monthly" {
  if (range === "1D") return FIVE_MIN_MS;
  if (range === "1W") return HOUR_MS;
  if (range === "1M" || range === "3M") return DAY_MS;
  if (range === "1Y") return "weekly";
  return "monthly";
}

export function buildChartBucketsForRange(
  points: PortfolioChartPoint[],
  range: PortfolioTimeRange,
  now: Date = new Date(),
  currentValue?: number,
): PortfolioChartBucket[] {
  const sorted = dedupeTimestamps(ensureSortedSeries(attachPointDates(points, now)));
  if (sorted.length === 0) return [];

  const { startAt, endAt } = getRangeWindow(range, sorted, now);

  switch (range) {
    case "1D":
      return buildFixedIntervalBuckets(
        sorted,
        startAt,
        endAt,
        FIVE_MIN_MS,
        resolvePeriodEndValue(sorted, endAt, currentValue),
      );
    case "1W":
      return buildFixedIntervalBuckets(sorted, startAt, endAt, HOUR_MS);
    case "1M":
    case "3M":
      return buildCalendarDayBuckets(sorted, startAt, endAt);
    case "1Y":
      return buildCalendarWeekBuckets(sorted, startAt, endAt);
    case "ALL": {
      const fullEnd = Math.max(sorted[sorted.length - 1].at!, endAt);
      return buildCalendarMonthBuckets(sorted, sorted[0].at!, fullEnd);
    }
    default:
      return [];
  }
}

export function bucketsToDisplaySeries(buckets: PortfolioChartBucket[]): PortfolioChartPoint[] {
  if (buckets.length === 0) return [];

  const points = buckets.map((bucket) => ({ t: bucket.at, at: bucket.at, v: bucket.v }));
  const last = buckets[buckets.length - 1];

  // Extend stepAfter line through the final partial bucket (matches range endAt).
  if (last.endAt > last.at) {
    points.push({ t: last.endAt, at: last.endAt, v: last.v });
  }

  return dedupeTimestamps(points);
}

/** Time domain for the rendered AreaChart — must match hover X mapping. */
export function getDisplayTimeDomain(display: PortfolioChartPoint[]): { min: number; max: number } {
  if (display.length === 0) return { min: 0, max: 0 };
  return { min: display[0].at!, max: display[display.length - 1].at! };
}

/** stepAfter line value at a timestamp on the display series. */
export function resolveDisplayLineValue(
  display: PortfolioChartPoint[],
  atMs: number,
): number {
  return stepValueAt(dedupeTimestamps(ensureSortedSeries(display)), atMs);
}

export function findBucketContaining(
  buckets: PortfolioChartBucket[],
  atMs: number,
): PortfolioChartBucket | null {
  if (buckets.length === 0) return null;

  for (let i = 0; i < buckets.length; i += 1) {
    const bucket = buckets[i];
    const isLast = i === buckets.length - 1;
    if (atMs >= bucket.startAt && (atMs < bucket.endAt || (isLast && atMs <= bucket.endAt))) {
      return bucket;
    }
  }

  if (atMs < buckets[0].startAt) return buckets[0];
  return buckets[buckets.length - 1];
}

export function resolveBucketHoverPoint(
  buckets: PortfolioChartBucket[],
  pointerAt: number,
): { at: number; v: number; bucket: PortfolioChartBucket | null } {
  const bucket = findBucketContaining(buckets, pointerAt);
  if (!bucket) return { at: pointerAt, v: 0, bucket: null };
  return { at: bucket.at, v: bucket.v, bucket };
}

export function buildDisplaySeriesForRange(
  points: PortfolioChartPoint[],
  range: PortfolioTimeRange,
  now: Date = new Date(),
  currentValue?: number,
): PortfolioChartPoint[] {
  const buckets = buildChartBucketsForRange(points, range, now, currentValue);
  return bucketsToDisplaySeries(buckets);
}

export function snapPointerToDisplaySeries(
  display: PortfolioChartPoint[],
  atMs: number,
): { at: number; v: number } {
  if (display.length === 0) return { at: atMs, v: 0 };
  return { at: atMs, v: resolveDisplayLineValue(display, atMs) };
}

/** @deprecated Use resolveBucketHoverPoint. */
export function resolveChartHoverPoint(
  displaySeries: PortfolioChartPoint[],
  pointerAt: number,
  _snapMode: HoverSnapMode,
): { at: number; v: number } {
  return snapPointerToDisplaySeries(displaySeries, pointerAt);
}

export function snapHoverToSeries(
  sorted: PortfolioChartPoint[],
  atMs: number,
  snapMode: HoverSnapMode,
): { at: number; v: number } {
  const range: PortfolioTimeRange =
    snapMode === "month" ? "ALL" : snapMode === "week" ? "1Y" : snapMode === "day" ? "1M" : "1D";
  const hover = resolveBucketHoverPoint(buildChartBucketsForRange(sorted, range), atMs);
  return { at: hover.at, v: hover.v };
}

export function sliceSeriesForRange(
  points: PortfolioChartPoint[],
  range: PortfolioTimeRange,
  now: Date = new Date(),
): PortfolioChartPoint[] {
  const sorted = dedupeTimestamps(ensureSortedSeries(attachPointDates(points, now)));
  if (sorted.length === 0) return [];

  const { startAt, endAt } = getRangeWindow(range, sorted, now);
  const inRange = sorted.filter((point) => point.at! >= startAt && point.at! <= endAt);

  if (inRange.length > 0) return inRange;

  return [
    { t: `${range}-start`, v: stepValueAt(sorted, startAt), at: startAt },
    { t: `${range}-end`, v: stepValueAt(sorted, endAt), at: endAt },
  ];
}

export function mapPointerToTimestamp(
  pointerX: number,
  plot: { left: number; width: number },
  domain: { min: number; max: number },
): number {
  if (plot.width <= 0 || domain.max <= domain.min) return domain.min;

  const ratio = Math.max(0, Math.min(1, (pointerX - plot.left) / plot.width));
  return domain.min + ratio * (domain.max - domain.min);
}

export function mapTimestampToPlotX(
  atMs: number,
  plot: { left: number; width: number },
  domain: { min: number; max: number },
): number {
  if (plot.width <= 0 || domain.max <= domain.min) return plot.left;

  const ratio = Math.max(0, Math.min(1, (atMs - domain.min) / (domain.max - domain.min)));
  return plot.left + ratio * plot.width;
}

export function mapValueToPlotY(
  value: number,
  plot: { top: number; height: number },
  domain: { min: number; max: number },
): number {
  if (plot.height <= 0) return plot.top;
  if (domain.max <= domain.min) return plot.top + plot.height / 2;

  const ratio = Math.max(0, Math.min(1, (value - domain.min) / (domain.max - domain.min)));
  return plot.top + (1 - ratio) * plot.height;
}

export function getSeriesValueBounds(points: PortfolioChartPoint[]): { min: number; max: number } {
  if (points.length === 0) return { min: 0, max: 0 };

  let min = points[0].v;
  let max = points[0].v;
  for (const point of points) {
    min = Math.min(min, point.v);
    max = Math.max(max, point.v);
  }
  return { min, max };
}

export function getPeriodBoundaryValues(
  points: PortfolioChartPoint[],
  range: PortfolioTimeRange,
  now: Date = new Date(),
  currentValue?: number,
): { startValue: number; endValue: number; startAt: number; endAt: number } {
  const sorted = dedupeTimestamps(ensureSortedSeries(attachPointDates(points, now)));
  if (sorted.length === 0) {
    return { startValue: 0, endValue: 0, startAt: 0, endAt: 0 };
  }

  const { startAt, endAt } = getRangeWindow(range, sorted, now);
  const startValue = stepValueAt(sorted, startAt);
  const endValue = resolvePeriodEndValue(sorted, endAt, currentValue);

  return { startValue, endValue, startAt, endAt };
}

export function computePeriodChangePercent(startValue: number, endValue: number): number {
  const start = Number.isFinite(startValue) ? startValue : 0;
  const end = Number.isFinite(endValue) ? endValue : 0;
  const delta = end - start;

  if (Math.abs(delta) < PERCENT_BASIS_EPSILON) return 0;
  if (Math.abs(start) >= PERCENT_BASIS_EPSILON) return (delta / start) * 100;
  if (Math.abs(end) >= PERCENT_BASIS_EPSILON) return (delta / end) * 100;
  return 0;
}

export function computeHoverChangePercent(
  periodStartValue: number,
  hoverValue: number,
  periodEndValue: number,
): number {
  const start = Number.isFinite(periodStartValue) ? periodStartValue : 0;
  const hover = Number.isFinite(hoverValue) ? hoverValue : 0;
  const end = Number.isFinite(periodEndValue) ? periodEndValue : hover;
  const delta = hover - start;

  if (Math.abs(delta) < PERCENT_BASIS_EPSILON) return 0;
  if (Math.abs(start) >= PERCENT_BASIS_EPSILON) return (delta / start) * 100;
  if (Math.abs(end) >= PERCENT_BASIS_EPSILON) return (delta / end) * 100;
  return 0;
}

export function formatPeriodChangeLabel(
  startValue: number,
  endValue: number,
  formatFlorin: (value: number) => string,
  formatPct: (value: number) => string,
): { label: string; positive: boolean; percent: number } {
  const safeStart = Number.isFinite(startValue) ? startValue : 0;
  const safeEnd = Number.isFinite(endValue) ? endValue : 0;
  const delta = safeEnd - safeStart;
  const sign = delta >= 0 ? "+" : "-";
  const percent = computePeriodChangePercent(safeStart, safeEnd);
  const amountLabel = `${sign}${formatFlorin(Math.abs(delta))}`;

  return {
    label: `${amountLabel} · ${formatPct(percent)}`,
    positive: delta >= 0,
    percent,
  };
}

export function formatPortfolioChartHoverDate(
  atMs: number,
  range: PortfolioTimeRange,
  _options?: {
    resolution?: SeriesResolution;
    snapMode?: HoverSnapMode;
    now?: Date;
  },
): string {
  const date = new Date(atMs);

  if (range === "1D") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: NY_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  if (range === "1W") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: NY_TIMEZONE,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }

  if (range === "1M" || range === "3M") {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: NY_TIMEZONE,
      month: "short",
      day: "numeric",
    }).format(date);
  }

  if (range === "1Y") {
    const weekStart = startOfLocalWeek(date);
    return `Week of ${new Intl.DateTimeFormat("en-US", {
      timeZone: NY_TIMEZONE,
      month: "short",
      day: "numeric",
    }).format(weekStart)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIMEZONE,
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatPeriodChangeFromValues(
  startValue: number,
  endValue: number,
  formatFlorin: (value: number) => string,
  formatPct: (value: number) => string,
): { label: string; positive: boolean } {
  return formatPeriodChangeLabel(startValue, endValue, formatFlorin, formatPct);
}

export function hoverValuesWithinPeriod(
  buckets: PortfolioChartBucket[],
  samples: number[],
): number[] {
  return samples.map((at) => resolveBucketHoverPoint(buckets, at).v);
}

/** Verify consecutive interior buckets share a fixed interval width. */
export function assertFixedBucketSpacing(
  buckets: PortfolioChartBucket[],
  intervalMs: number,
): void {
  for (let i = 1; i < buckets.length - 1; i += 1) {
    const gap = buckets[i].startAt - buckets[i - 1].startAt;
    if (gap !== intervalMs) {
      throw new Error(`expected ${intervalMs}ms spacing, got ${gap}ms at index ${i}`);
    }
  }
}
