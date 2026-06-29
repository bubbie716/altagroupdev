import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  computeBucketSelectionMetrics,
  formatSelectionPerformanceDisplay,
  isSelectionVisible,
  normalizeBucketSelectionIndices,
  resolveBucketIndexAtPointer,
  type PortfolioChartSelectionIndices,
} from "@/lib/account/portfolio-chart-range-selection";
import {
  getDisplayTimeDomain,
  getSeriesValueBounds,
  mapPointerToTimestamp,
  mapTimestampToPlotX,
  mapValueToPlotY,
  PORTFOLIO_CHART_MARGIN,
  type PortfolioChartBucket,
  type PortfolioChartPoint,
  type PortfolioTimeRange,
} from "@/lib/account/portfolio-chart-series";
import { florin } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type ChartMargin = typeof PORTFOLIO_CHART_MARGIN;

export type ChartSelectionGeometry = {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  left: number;
  width: number;
};

function getPlotFromRect(rect: DOMRect, margin: ChartMargin) {
  return {
    left: margin.left,
    top: margin.top,
    width: rect.width - margin.left - margin.right,
    height: rect.height - margin.top - margin.bottom,
  };
}

export function resolveSelectionGeometry(
  buckets: PortfolioChartBucket[],
  displaySeries: PortfolioChartPoint[],
  selection: PortfolioChartSelectionIndices,
  rect: DOMRect,
  margin: ChartMargin = PORTFOLIO_CHART_MARGIN,
): ChartSelectionGeometry | null {
  if (!isSelectionVisible(selection)) return null;

  const { startIndex, endIndex } = normalizeBucketSelectionIndices(
    selection.startIndex,
    selection.endIndex,
  );
  const startBucket = buckets[startIndex];
  const endBucket = buckets[endIndex];
  if (!startBucket || !endBucket) return null;

  const plot = getPlotFromRect(rect, margin);
  const timeDomain = getDisplayTimeDomain(displaySeries);
  const valueBounds = getSeriesValueBounds(displaySeries);

  const startX = mapTimestampToPlotX(startBucket.at, plot, timeDomain);
  const endX = mapTimestampToPlotX(endBucket.at, plot, timeDomain);
  const startY = mapValueToPlotY(startBucket.v, plot, valueBounds);
  const endY = mapValueToPlotY(endBucket.v, plot, valueBounds);

  return {
    startX,
    endX,
    startY,
    endY,
    left: Math.min(startX, endX),
    width: Math.abs(endX - startX),
  };
}

export function PortfolioChartSelectionOverlay({
  geometry,
  margin = PORTFOLIO_CHART_MARGIN,
}: {
  geometry: ChartSelectionGeometry;
  margin?: ChartMargin;
}) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute z-[1] bg-gold/10"
        style={{
          left: geometry.left,
          top: margin.top,
          width: geometry.width,
          bottom: margin.bottom,
        }}
      />
      {[geometry.startX, geometry.endX].map((x) => (
        <div
          key={x}
          aria-hidden
          className="pointer-events-none absolute z-[2] w-px border-l border-dashed border-gold/70"
          style={{
            left: x,
            top: margin.top,
            bottom: margin.bottom,
          }}
        />
      ))}
      {[
        { x: geometry.startX, y: geometry.startY },
        { x: geometry.endX, y: geometry.endY },
      ].map((point) => (
        <div
          key={`${point.x}-${point.y}`}
          aria-hidden
          className="pointer-events-none absolute z-[4] size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-gold"
          style={{ left: point.x, top: point.y }}
        />
      ))}
    </>
  );
}

export function PortfolioChartSelectionTooltip({
  timeRange,
  selection,
  buckets,
  geometry,
  containerWidth,
  containerHeight,
}: {
  timeRange: PortfolioTimeRange;
  selection: PortfolioChartSelectionIndices;
  buckets: PortfolioChartBucket[];
  geometry: ChartSelectionGeometry;
  containerWidth: number;
  containerHeight: number;
}) {
  const metrics = useMemo(
    () => computeBucketSelectionMetrics(buckets, selection.startIndex, selection.endIndex),
    [buckets, selection.endIndex, selection.startIndex],
  );

  if (!metrics) return null;

  const display = formatSelectionPerformanceDisplay(metrics, timeRange, florin);
  const anchorX = geometry.left + geometry.width / 2;
  const anchorY = Math.min(geometry.startY, geometry.endY);

  const tooltipHeight = 88;
  const gap = 12;
  const edge = 8;

  const top = Math.max(
    edge,
    Math.min(anchorY - gap - tooltipHeight, containerHeight - tooltipHeight - edge),
  );
  const left = Math.max(edge, Math.min(anchorX, containerWidth - edge));

  return (
    <div
      className="pointer-events-none absolute z-[5] w-max max-w-[calc(100%-1rem)] -translate-x-1/2"
      style={{ left, top }}
    >
      <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 shadow-sm">
        <div className="type-meta whitespace-nowrap text-[10px] leading-snug text-muted-foreground">
          {display.rangeLabel}
        </div>
        <div
          className={cn(
            "tabular mt-1 whitespace-nowrap text-sm font-semibold",
            display.positive ? "text-[var(--success)]" : "text-[var(--danger)]",
          )}
        >
          {display.amountLabel}
        </div>
        <div
          className={cn(
            "tabular mt-0.5 whitespace-nowrap text-xs",
            display.positive ? "text-[var(--success)]" : "text-[var(--danger)]",
          )}
        >
          {display.percentLabel}
        </div>
      </div>
    </div>
  );
}
export function usePortfolioChartRangeSelection({
  containerRef,
  buckets,
  displaySeries,
  disabled = false,
  margin = PORTFOLIO_CHART_MARGIN,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  buckets: PortfolioChartBucket[];
  displaySeries: PortfolioChartPoint[];
  disabled?: boolean;
  margin?: ChartMargin;
}) {
  const [selection, setSelection] = useState<PortfolioChartSelectionIndices | null>(null);
  const draggingRef = useRef(false);

  const clearSelection = useCallback(() => {
    draggingRef.current = false;
    setSelection(null);
  }, []);

  const resolveIndexFromClientX = useCallback(
    (clientX: number): number => {
      const node = containerRef.current;
      if (!node || buckets.length === 0) return 0;

      const rect = node.getBoundingClientRect();
      const plot = getPlotFromRect(rect, margin);
      const timeDomain = getDisplayTimeDomain(displaySeries);
      const localX = clientX - rect.left;
      const pointerAt = mapPointerToTimestamp(localX, plot, timeDomain);
      return resolveBucketIndexAtPointer(buckets, pointerAt);
    },
    [buckets, containerRef, displaySeries, margin],
  );

  useEffect(() => {
    clearSelection();
  }, [buckets, clearSelection]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const index = resolveIndexFromClientX(event.clientX);
      draggingRef.current = true;
      setSelection({ startIndex: index, endIndex: index, isDragging: true });
      element.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      const index = resolveIndexFromClientX(event.clientX);
      setSelection((current) =>
        current ? { ...current, endIndex: index, isDragging: true } : null,
      );
    };

    const releaseSelection = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
      setSelection(null);
    };

    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerup", releaseSelection);
    element.addEventListener("pointercancel", releaseSelection);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerup", releaseSelection);
      element.removeEventListener("pointercancel", releaseSelection);
    };
  }, [containerRef, disabled, resolveIndexFromClientX]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, disabled]);

  const isSelecting = selection?.isDragging ?? false;

  return {
    selection,
    isSelecting,
    clearSelection,
  };
}
