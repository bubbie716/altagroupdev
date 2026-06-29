export type PortfolioChartPoint = {
  t: string | number;
  v: number;
  at?: number;
};

export type PortfolioTimeRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "ALL";

export type SeriesResolution = "intraday" | "daily";

export type HoverSnapMode = "continuous" | "day" | "week" | "month";

export const PORTFOLIO_CHART_MARGIN = { top: 4, right: 4, bottom: 4, left: 4 };

/** Calendar-day lookbacks (inclusive of today). 1D is handled separately (today only). */
export const PORTFOLIO_RANGE_DAYS: Record<Exclude<PortfolioTimeRange, "1D" | "ALL">, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
};

export const CHART_HISTORY_DAYS = 365;

const PERCENT_BASIS_EPSILON = 0.01;

const NY_TIMEZONE = "America/New_York";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FIVE_MIN_MS = 5 * 60 * 1000;

const INTRADAY_GAP_MS = 20 * HOUR_MS;
const YEAR_WEEKLY_THRESHOLD = 260;

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

export function ensureSortedSeries(points: PortfolioChartPoint[]): PortfolioChartPoint[] {
  return [...points]
    .map((point) => ({
      ...point,
      v: typeof point.v === "number" ? point.v : Number(point.v),
    }))
    .filter((point) => point.at != null && Number.isFinite(point.v))
    .sort((a, b) => a.at! - b.at!);
}

/** Keep the last value when multiple points share the same timestamp. */
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

/** Assign local start-of-day timestamps to points missing `at` (mock/demo series). */
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
  resolution: SeriesResolution,
): HoverSnapMode {
  if (resolution === "intraday") return "continuous";
  if (range === "1Y") return "week";
  if (range === "ALL") return "month";
  return "day";
}

export function getChartLineType(resolution: SeriesResolution): "linear" | "stepAfter" {
  return resolution === "intraday" ? "linear" : "stepAfter";
}

/**
 * Unified calendar range boundaries for slice, P&L, display, and hover.
 * 1D: today 12:00 AM → now
 * 1W: last 7 calendar days (inclusive) → now
 * 1M/3M/1Y: last N calendar days (inclusive) → now
 * ALL: first source point → max(last source, now)
 */
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

/** Step-style value: held constant until the next source observation. */
export function stepValueAt(sorted: PortfolioChartPoint[], atMs: number): number {
  if (sorted.length === 0) return 0;
  const point = findLastPointAtOrBefore(sorted, atMs);
  return point?.v ?? sorted[0].v;
}

export function interpolateSeriesAt(
  sorted: PortfolioChartPoint[],
  atMs: number,
): { at: number; v: number } {
  if (sorted.length === 0) return { at: atMs, v: 0 };
  if (sorted.length === 1) return { at: atMs, v: sorted[0].v };

  const firstAt = sorted[0].at!;
  const lastAt = sorted[sorted.length - 1].at!;

  if (atMs <= firstAt) return { at: atMs, v: sorted[0].v };
  if (atMs >= lastAt) return { at: atMs, v: sorted[sorted.length - 1].v };

  let lo = 0;
  let hi = sorted.length - 1;

  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].at! <= atMs) lo = mid;
    else hi = mid;
  }

  const left = sorted[lo];
  const right = sorted[hi];
  const span = right.at! - left.at!;
  const ratio = span === 0 ? 0 : (atMs - left.at!) / span;

  return {
    at: atMs,
    v: left.v + ratio * (right.v - left.v),
  };
}

export function snapPointerToDisplaySeries(
  display: PortfolioChartPoint[],
  atMs: number,
): { at: number; v: number } {
  if (display.length === 0) return { at: atMs, v: 0 };
  if (display.length === 1) return { at: display[0].at!, v: display[0].v };

  const anchor = findLastPointAtOrBefore(display, atMs);
  if (anchor) return { at: anchor.at!, v: anchor.v };

  return { at: display[0].at!, v: display[0].v };
}

export function snapHoverToSeries(
  sorted: PortfolioChartPoint[],
  atMs: number,
  snapMode: HoverSnapMode,
): { at: number; v: number } {
  if (sorted.length === 0) return { at: atMs, v: 0 };

  if (snapMode === "continuous") {
    return interpolateSeriesAt(sorted, atMs);
  }

  if (snapMode === "day") {
    const dayKey = localDayKey(atMs);
    let dayAnchor: PortfolioChartPoint | null = null;
    for (const point of sorted) {
      if (localDayKey(point.at!) === dayKey) dayAnchor = point;
    }

    if (dayAnchor) {
      return { at: dayAnchor.at!, v: dayAnchor.v };
    }

    const dayEndMs = startOfLocalDay(new Date(atMs)).getTime() + DAY_MS - 1;
    const stepAnchor = findLastPointAtOrBefore(sorted, dayEndMs);
    return {
      at: stepAnchor?.at ?? dayEndMs,
      v: stepValueAt(sorted, dayEndMs),
    };
  }

  if (snapMode === "week") {
    const weekly = buildWeeklyDisplaySeries(sorted);
    return snapToNearestByTime(weekly, atMs);
  }

  const monthly = buildCalendarMonthDisplaySeries(
    sorted,
    sorted[0].at!,
    sorted[sorted.length - 1].at!,
  );
  return snapToNearestByTime(monthly, atMs);
}

function snapToNearestByTime(
  points: PortfolioChartPoint[],
  atMs: number,
): { at: number; v: number } {
  if (points.length === 0) return { at: atMs, v: 0 };
  if (points.length === 1) return { at: points[0].at!, v: points[0].v };

  let nearest = points[0];
  let nearestDistance = Math.abs(atMs - nearest.at!);

  for (const point of points) {
    const distance = Math.abs(atMs - point.at!);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return { at: nearest.at!, v: nearest.v };
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

function buildConstantIntervalSeries(
  startAt: number,
  endAt: number,
  intervalMs: number,
  value: number,
): PortfolioChartPoint[] {
  if (endAt < startAt || intervalMs <= 0) return [];

  const points: PortfolioChartPoint[] = [];
  let at = startAt;

  while (at < endAt) {
    points.push({ t: at, at, v: value });
    at += intervalMs;
  }

  points.push({ t: endAt, at: endAt, v: value });
  return points;
}

function buildStepIntervalDisplaySeries(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
  intervalMs: number,
): PortfolioChartPoint[] {
  if (sorted.length === 0 || endAt < startAt || intervalMs <= 0) return [];

  const points: PortfolioChartPoint[] = [];
  let at = startAt;

  while (at < endAt) {
    points.push({ t: at, at, v: stepValueAt(sorted, at) });
    at += intervalMs;
  }

  points.push({ t: endAt, at: endAt, v: stepValueAt(sorted, endAt) });
  return points;
}

function buildDailyDisplaySeries(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
): PortfolioChartPoint[] {
  return buildStepIntervalDisplaySeries(sorted, startAt, endAt, DAY_MS);
}

/** Target display cadence per range (step-held values, not interpolated). */
export function resolveDisplayInterval(
  range: PortfolioTimeRange,
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
): number | "weekly" | "monthly" {
  if (range === "1D") return FIVE_MIN_MS;
  if (range === "1W") return HOUR_MS;
  if (range === "1M" || range === "3M") return DAY_MS;

  if (range === "1Y") {
    const inWindow = sorted.filter((point) => point.at! >= startAt && point.at! <= endAt);
    return inWindow.length > YEAR_WEEKLY_THRESHOLD ? "weekly" : DAY_MS;
  }

  return "monthly";
}

function buildWeeklyDisplaySeries(sorted: PortfolioChartPoint[]): PortfolioChartPoint[] {
  if (sorted.length === 0) return [];

  const byWeek = new Map<string, PortfolioChartPoint>();

  for (const point of sorted) {
    const weekStart = startOfLocalWeek(new Date(point.at!));
    const key = localDayKey(weekStart.getTime());
    const existing = byWeek.get(key);
    if (!existing || point.at! >= existing.at!) {
      byWeek.set(key, point);
    }
  }

  return [...byWeek.values()].sort((a, b) => a.at! - b.at!);
}

function startOfLocalWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function buildCalendarMonthDisplaySeries(
  sorted: PortfolioChartPoint[],
  startAt: number,
  endAt: number,
): PortfolioChartPoint[] {
  if (sorted.length === 0) return [];

  const points: PortfolioChartPoint[] = [];
  const cursor = startOfLocalDay(new Date(startAt));
  cursor.setDate(1);

  while (cursor.getTime() <= endAt) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    const at = Math.min(monthEnd.getTime(), endAt);
    points.push({
      t: at,
      at,
      v: stepValueAt(sorted, at),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}

/**
 * Display series at fixed range intervals. Values use step semantics from source
 * data (no linear interpolation between daily observations).
 */
export function buildDisplaySeriesForRange(
  points: PortfolioChartPoint[],
  range: PortfolioTimeRange,
  now: Date = new Date(),
): PortfolioChartPoint[] {
  const sorted = dedupeTimestamps(ensureSortedSeries(attachPointDates(points, now)));
  if (sorted.length === 0) return [];

  const { startAt, endAt } = getRangeWindow(range, sorted, now);
  const interval = resolveDisplayInterval(range, sorted, startAt, endAt);
  const resolution = detectSeriesResolution(sorted);

  if (range === "1D" && resolution === "daily") {
    return buildConstantIntervalSeries(
      startAt,
      endAt,
      FIVE_MIN_MS,
      stepValueAt(sorted, endAt),
    );
  }

  if (interval === "monthly") {
    const fullEnd = Math.max(sorted[sorted.length - 1].at!, endAt);
    return buildCalendarMonthDisplaySeries(sorted, sorted[0].at!, fullEnd);
  }

  if (interval === "weekly") {
    const inWindow = sorted.filter((point) => point.at! >= startAt && point.at! <= endAt);
    const slice = inWindow.length > 0 ? inWindow : sorted;
    return buildWeeklyDisplaySeries(slice);
  }

  if (interval === DAY_MS) {
    return buildDailyDisplaySeries(sorted, startAt, endAt);
  }

  return buildStepIntervalDisplaySeries(sorted, startAt, endAt, interval);
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

/** Period P&L boundaries — same calendar window as slice/display. */
export function getPeriodBoundaryValues(
  points: PortfolioChartPoint[],
  range: PortfolioTimeRange,
  now: Date = new Date(),
): { startValue: number; endValue: number; startAt: number; endAt: number } {
  const sorted = dedupeTimestamps(ensureSortedSeries(attachPointDates(points, now)));
  if (sorted.length === 0) {
    return { startValue: 0, endValue: 0, startAt: 0, endAt: 0 };
  }

  const { startAt, endAt } = getRangeWindow(range, sorted, now);
  const startValue = stepValueAt(sorted, startAt);
  const endValue = stepValueAt(sorted, endAt);

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
  options?: {
    resolution?: SeriesResolution;
    snapMode?: HoverSnapMode;
    now?: Date;
  },
): string {
  const resolution = options?.resolution ?? "daily";
  const snapMode = options?.snapMode ?? getHoverSnapMode(range, resolution);
  const now = options?.now ?? new Date();
  const date = new Date(atMs);

  if (range === "1D") {
    if (resolution === "intraday" && snapMode === "continuous") {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: NY_TIMEZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    }
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
      month: "short",
      day: "numeric",
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
