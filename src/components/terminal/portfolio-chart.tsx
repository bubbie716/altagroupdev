"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import {
  PortfolioChartSelectionOverlay,
  PortfolioChartSelectionTooltip,
  resolveSelectionGeometry,
  usePortfolioChartRangeSelection,
} from "@/components/account/portfolio-chart-range-selection";
import {
  PortfolioHoverCrosshair,
  PortfolioHoverTooltip,
  usePortfolioChartHover,
} from "@/components/account/portfolio-chart-hover";
import { RangeSelector } from "@/components/terminal/range-selector";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import {
  bucketsToDisplaySeries,
  detectSeriesResolution,
  getSeriesValueBounds,
  PORTFOLIO_CHART_MARGIN,
  type PortfolioChartBucket,
  type PortfolioChartPoint,
} from "@/lib/account/portfolio-chart-series";
import { isSelectionVisible } from "@/lib/account/portfolio-chart-range-selection";
import type { PricePoint, TerminalChartRange } from "@/lib/terminal/types";
import { cn } from "@/lib/utils";

function buildTerminalChartModel(data: PricePoint[]): {
  buckets: PortfolioChartBucket[];
  displaySeries: PortfolioChartPoint[];
} {
  const sorted = [...data]
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
    .sort((a, b) => a.t - b.t)
    .filter((point, index, rows) => index === rows.length - 1 || point.t !== rows[index + 1]?.t);

  if (sorted.length === 0) return { buckets: [], displaySeries: [] };

  const fallbackInterval =
    sorted.length > 1 ? Math.max(1, sorted[sorted.length - 1].t - sorted[sorted.length - 2].t) : 1;
  const buckets = sorted.map((point, index): PortfolioChartBucket => {
    const next = sorted[index + 1];
    return {
      at: point.t,
      startAt: point.t,
      endAt: next?.t ?? point.t + fallbackInterval,
      v: point.v,
    };
  });

  return { buckets, displaySeries: bucketsToDisplaySeries(buckets) };
}

function InteractiveTerminalChart({
  data,
  range,
  positive,
  heightClass,
  ariaLabel,
}: {
  data: PricePoint[];
  range: TerminalChartRange;
  positive: boolean;
  heightClass: string;
  ariaLabel: string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const gradientSeed = useId().replace(/:/g, "");
  const stroke = positive ? "var(--terminal-green)" : "var(--terminal-red)";
  const gradientId = `${gradientSeed}-${positive ? "up" : "down"}`;

  const { buckets, displaySeries } = useMemo(() => buildTerminalChartModel(data), [data]);
  const bounds = useMemo(() => getSeriesValueBounds(displaySeries), [displaySeries]);
  const periodStartValue = buckets[0]?.v ?? 0;
  const periodEndValue = buckets[buckets.length - 1]?.v ?? periodStartValue;
  const resolution = useMemo(() => detectSeriesResolution(displaySeries), [displaySeries]);

  const { selection, isSelecting } = usePortfolioChartRangeSelection({
    containerRef: chartContainerRef,
    buckets,
    displaySeries,
    margin: PORTFOLIO_CHART_MARGIN,
  });
  const showSelectionUi = isSelecting && selection != null && isSelectionVisible(selection);

  const selectionGeometry = useMemo(() => {
    if (!selection || !isSelectionVisible(selection) || containerSize.width <= 0) return null;
    const rect = {
      width: containerSize.width,
      height: containerSize.height,
      left: 0,
      top: 0,
      right: containerSize.width,
      bottom: containerSize.height,
    } as DOMRect;
    return resolveSelectionGeometry(
      buckets,
      displaySeries,
      selection,
      rect,
      PORTFOLIO_CHART_MARGIN,
    );
  }, [buckets, containerSize.height, containerSize.width, displaySeries, selection]);

  const { hover } = usePortfolioChartHover({
    containerRef: chartContainerRef,
    buckets,
    displaySeries,
    periodStartValue,
    periodEndValue,
    suppressHover: showSelectionUi,
    margin: PORTFOLIO_CHART_MARGIN,
  });

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return;
    const updateSize = () => {
      const width = Math.max(0, Math.floor(node.clientWidth));
      const height = Math.max(0, Math.floor(node.clientHeight));
      setContainerSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    updateSize();
    // Capture once after layout so the first paint isn’t stuck at 0×0.
    const raf = window.requestAnimationFrame(updateSize);
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={chartContainerRef}
      className={cn(
        "relative min-w-0 w-full touch-none cursor-crosshair overflow-hidden",
        heightClass,
      )}
      role="img"
      aria-label={`${ariaLabel}. Move across the chart for values or drag to measure performance between two points.`}
    >
      {displaySeries.length && containerSize.width > 0 && containerSize.height > 0 ? (
        <>
          <AreaChart
            width={containerSize.width}
            height={containerSize.height}
            data={displaySeries}
            margin={PORTFOLIO_CHART_MARGIN}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis hide type="number" dataKey="at" domain={["dataMin", "dataMax"]} />
            <YAxis hide domain={[bounds.min, bounds.max]} />
            <Area
              type="stepAfter"
              dataKey="v"
              stroke={stroke}
              strokeWidth={1.8}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              activeDot={false}
            />
          </AreaChart>
          {selectionGeometry ? (
            <PortfolioChartSelectionOverlay geometry={selectionGeometry} />
          ) : null}
          {showSelectionUi && selection && selectionGeometry ? (
            <PortfolioChartSelectionTooltip
              timeRange={range}
              selection={selection}
              buckets={buckets}
              geometry={selectionGeometry}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          ) : null}
          {hover && !showSelectionUi ? <PortfolioHoverCrosshair hover={hover} /> : null}
          {hover && !showSelectionUi && containerSize.width > 0 && containerSize.height > 0 ? (
            <PortfolioHoverTooltip
              hover={hover}
              timeRange={range}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
              periodStartValue={periodStartValue}
              resolution={resolution}
            />
          ) : null}
        </>
      ) : displaySeries.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[13px] text-[var(--terminal-muted)]">
          Chart unavailable
        </div>
      ) : (
        <div
          className="h-full w-full animate-pulse rounded-md bg-[var(--terminal-surface-2)]"
          aria-hidden
        />
      )}
    </div>
  );
}

export function PortfolioChart({
  seriesByRange,
  equityValue,
  dayChange,
  dayChangePercent,
  valuationAvailable,
  className,
  range: controlledRange,
  onRangeChange,
}: {
  seriesByRange: Record<TerminalChartRange, PricePoint[]>;
  equityValue: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  valuationAvailable: boolean;
  className?: string;
  range?: TerminalChartRange;
  onRangeChange?: (range: TerminalChartRange) => void;
}) {
  const [localRange, setLocalRange] = useState<TerminalChartRange>("1D");
  const range = controlledRange ?? localRange;
  const setRange = onRangeChange ?? setLocalRange;
  const data = useMemo(() => seriesByRange[range] ?? [], [range, seriesByRange]);
  const rangeChange = useMemo(() => {
    const start = data[0]?.v;
    const end = data[data.length - 1]?.v;
    if (start == null || end == null || start === 0) {
      return { amount: dayChange, percent: dayChangePercent };
    }
    return { amount: end - start, percent: ((end - start) / Math.abs(start)) * 100 };
  }, [data, dayChange, dayChangePercent]);
  const positive = (rangeChange.amount ?? 0) >= 0;

  return (
    <section className={cn("min-w-0 space-y-4", className)} aria-label="Portfolio performance">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-[var(--terminal-muted)]">Portfolio value</p>
          <MoneyValue value={equityValue} size="xl" className="mt-1 block" />
          <div className="mt-2">
            <PriceChange amount={rangeChange.amount} percent={rangeChange.percent} />
          </div>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>
      {valuationAvailable ? (
        <InteractiveTerminalChart
          data={data}
          range={range}
          positive={positive}
          heightClass="h-[220px] sm:h-[260px]"
          ariaLabel={`Portfolio chart for ${range}`}
        />
      ) : (
        <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[var(--terminal-border)] text-[13px] text-[var(--terminal-muted)] sm:h-[260px]">
          Portfolio chart unavailable without market valuation
        </div>
      )}
    </section>
  );
}

export function SecurityChart({
  seriesByRange,
  positive,
  className,
  range,
  onRangeChange,
  /** @deprecated Prefer controlled `range` + `onRangeChange` (URL-synced). */
  initialRange = "1D",
}: {
  seriesByRange: Record<TerminalChartRange, PricePoint[]>;
  positive: boolean;
  className?: string;
  range?: TerminalChartRange;
  onRangeChange?: (range: TerminalChartRange) => void;
  initialRange?: TerminalChartRange;
}) {
  const [localRange, setLocalRange] = useState<TerminalChartRange>(initialRange);
  const activeRange = range ?? localRange;
  const setRange = onRangeChange ?? setLocalRange;
  const data = useMemo(() => seriesByRange[activeRange] ?? [], [activeRange, seriesByRange]);

  return (
    <section className={cn("min-w-0 space-y-3", className)} aria-label="Price history">
      <div className="flex justify-end">
        <RangeSelector value={activeRange} onChange={setRange} />
      </div>
      <InteractiveTerminalChart
        data={data}
        range={activeRange}
        positive={positive}
        heightClass="max-[359px]:h-[min(148px,calc(100svh-29rem))] h-[148px] min-[360px]:h-[188px] min-[375px]:h-[220px] sm:h-[320px]"
        ariaLabel={`Price history ${activeRange}`}
      />
    </section>
  );
}
