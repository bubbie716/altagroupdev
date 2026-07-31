import {
  computePeriodChangePercent,
  findBucketContaining,
  formatPortfolioChartHoverDate,
  type PortfolioChartBucket,
  type PortfolioTimeRange,
} from "./portfolio-chart-series.ts";

/** Display floor for percent labels only (0.01 percentage points). */
const PERCENT_LABEL_EPSILON = 0.01;
/** Float-noise floor for absolute deltas — not a cent-scale money floor. */
const VALUE_DELTA_NOISE = 1e-10;

/** Movement past this distance (px) promotes a press into range-drag; below it is a tap. */
export const PORTFOLIO_CHART_DRAG_THRESHOLD_PX = 10;

export function isPointerDragPastThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  thresholdPx = PORTFOLIO_CHART_DRAG_THRESHOLD_PX,
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return dx * dx + dy * dy >= thresholdPx * thresholdPx;
}

export type PortfolioChartSelectionIndices = {
  startIndex: number;
  endIndex: number;
  isDragging: boolean;
};

export type PortfolioChartSelectionMetrics = {
  startIndex: number;
  endIndex: number;
  startBucket: PortfolioChartBucket;
  endBucket: PortfolioChartBucket;
  startValue: number;
  endValue: number;
  absoluteChange: number;
  percentChange: number;
  positive: boolean;
};

export function resolveBucketIndexAtPointer(
  buckets: PortfolioChartBucket[],
  pointerAt: number,
): number {
  if (buckets.length === 0) return 0;
  const bucket = findBucketContaining(buckets, pointerAt);
  if (!bucket) return 0;
  const index = buckets.indexOf(bucket);
  return index >= 0 ? index : 0;
}

export function normalizeBucketSelectionIndices(
  startIndex: number,
  endIndex: number,
): { startIndex: number; endIndex: number } {
  return {
    startIndex: Math.min(startIndex, endIndex),
    endIndex: Math.max(startIndex, endIndex),
  };
}

export function isSelectionVisible(selection: PortfolioChartSelectionIndices | null): boolean {
  if (!selection) return false;
  return selection.startIndex !== selection.endIndex;
}

export function computeBucketSelectionMetrics(
  buckets: PortfolioChartBucket[],
  startIndex: number,
  endIndex: number,
): PortfolioChartSelectionMetrics | null {
  if (buckets.length === 0) return null;

  const { startIndex: from, endIndex: to } = normalizeBucketSelectionIndices(startIndex, endIndex);
  if (from === to) return null;

  const startBucket = buckets[from];
  const endBucket = buckets[to];
  const startValue = startBucket.v;
  const endValue = endBucket.v;
  const absoluteChange = endValue - startValue;
  const percentChange = computePeriodChangePercent(startValue, endValue);

  return {
    startIndex: from,
    endIndex: to,
    startBucket,
    endBucket,
    startValue,
    endValue,
    absoluteChange,
    percentChange,
    positive: absoluteChange >= 0,
  };
}

export function formatSelectionAmountLabel(
  absoluteChange: number,
  formatFlorin: (value: number) => string,
): string {
  if (!Number.isFinite(absoluteChange) || Math.abs(absoluteChange) < VALUE_DELTA_NOISE) {
    return formatFlorin(0);
  }
  const sign = absoluteChange >= 0 ? "+" : "-";
  return `${sign}${formatFlorin(Math.abs(absoluteChange))}`;
}

export function formatSelectionPercentLabel(percentChange: number): string {
  if (!Number.isFinite(percentChange) || Math.abs(percentChange) < PERCENT_LABEL_EPSILON) {
    return "0.00%";
  }
  const sign = percentChange >= 0 ? "+" : "-";
  return `${sign}${Math.abs(percentChange).toFixed(2)}%`;
}

export function formatPortfolioChartSelectionRange(
  startAt: number,
  endAt: number,
  range: PortfolioTimeRange,
  options?: { allBucketKind?: "day" | "week" | "month" },
): string {
  const startLabel = formatPortfolioChartHoverDate(startAt, range, options);
  const endLabel = formatPortfolioChartHoverDate(endAt, range, options);
  return `${startLabel} – ${endLabel}`;
}

export function formatSelectionPerformanceDisplay(
  metrics: PortfolioChartSelectionMetrics,
  range: PortfolioTimeRange,
  formatFlorin: (value: number) => string,
  options?: { allBucketKind?: "day" | "week" | "month" },
): {
  amountLabel: string;
  percentLabel: string;
  rangeLabel: string;
  positive: boolean;
} {
  return {
    amountLabel: formatSelectionAmountLabel(metrics.absoluteChange, formatFlorin),
    percentLabel: formatSelectionPercentLabel(metrics.percentChange),
    rangeLabel: formatPortfolioChartSelectionRange(
      metrics.startBucket.at,
      metrics.endBucket.at,
      range,
      options,
    ),
    positive: metrics.positive,
  };
}

/** Bucket values only — same bucket always yields identical start/end values. */
export function selectionValuesStableWithinBucket(
  buckets: PortfolioChartBucket[],
  bucketIndex: number,
  samples: number[],
): boolean {
  const metrics = computeBucketSelectionMetrics(buckets, bucketIndex, bucketIndex);
  if (metrics) return false;
  const bucket = buckets[bucketIndex];
  if (!bucket) return true;
  return samples.every((at) => {
    const contained = findBucketContaining(buckets, at);
    return contained === bucket;
  });
}
