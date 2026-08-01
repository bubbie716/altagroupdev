/**
 * Helpers for Terminal chart sizing.
 * Avoid Recharts ResponsiveContainer's initialDimension {-1,-1} first-paint warning
 * by only mounting charts with measured positive pixel dimensions.
 */

export type ChartContainerSize = {
  width: number;
  height: number;
};

export function isMeasurableChartSize(size: ChartContainerSize): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/** Floor to whole CSS pixels; never returns non-positive dimensions. */
export function chartPixelSize(size: ChartContainerSize): ChartContainerSize {
  return {
    width: Math.max(1, Math.floor(size.width)),
    height: Math.max(1, Math.floor(size.height)),
  };
}
