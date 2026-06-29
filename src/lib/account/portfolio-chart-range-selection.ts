import {
  findBucketContaining,
  formatPortfolioChartHoverDate,
  type PortfolioChartBucket,
  type PortfolioTimeRange,
} from "./portfolio-chart-series.ts";

const PERCENT_BASIS_EPSILON = 0.01;

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
  percentChange: number | null;
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
  const percentChange =
    Math.abs(startValue) < PERCENT_BASIS_EPSILON ? null : (absoluteChange / startValue) * 100;

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
  if (Math.abs(absoluteChange) < PERCENT_BASIS_EPSILON) {
    return formatFlorin(0);
  }
  const sign = absoluteChange >= 0 ? "+" : "-";
  return `${sign}${formatFlorin(Math.abs(absoluteChange))}`;
}

export function formatSelectionPercentLabel(percentChange: number | null): string {
  if (percentChange == null || !Number.isFinite(percentChange)) {
    return "—";
  }
  if (Math.abs(percentChange) < PERCENT_BASIS_EPSILON) {
    return "0.00%";
  }
  const sign = percentChange >= 0 ? "+" : "-";
  return `${sign}${Math.abs(percentChange).toFixed(2)}%`;
}

export function formatPortfolioChartSelectionRange(
  startAt: number,
  endAt: number,
  range: PortfolioTimeRange,
): string {
  const startLabel = formatPortfolioChartHoverDate(startAt, range);
  const endLabel = formatPortfolioChartHoverDate(endAt, range);
  return `${startLabel} – ${endLabel}`;
}

export function formatSelectionPerformanceDisplay(
  metrics: PortfolioChartSelectionMetrics,
  range: PortfolioTimeRange,
  formatFlorin: (value: number) => string,
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
