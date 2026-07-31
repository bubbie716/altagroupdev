"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
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
  attachPointDates,
  buildChartBucketsForRange,
  buildDisplaySeriesForRange,
  detectSeriesResolution,
  getChartLineType,
  getPeriodBoundaryValues,
  getSeriesValueBounds,
  PORTFOLIO_CHART_MARGIN,
  type PortfolioChartPoint,
  type PortfolioTimeRange,
} from "@/lib/account/portfolio-chart-series";
import { isSelectionVisible } from "@/lib/account/portfolio-chart-range-selection";
import type { PricePoint, TerminalChartRange } from "@/lib/terminal/types";
import { cn } from "@/lib/utils";

/** Same series pipeline as account portfolio dashboard charts. */
function toDatedSeries(data: PricePoint[]): PortfolioChartPoint[] {
  return attachPointDates(
    data
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
      .map((point) => ({ t: point.t, v: point.v, at: point.t })),
  );
}

function InteractiveTerminalChart({
  data,
  range,
  positive,
  heightClass,
  ariaLabel,
  formatValue,
  formatDelta,
}: {
  data: PricePoint[];
  range: TerminalChartRange;
  positive: boolean;
  heightClass: string;
  ariaLabel: string;
  formatValue?: (value: number) => string;
  formatDelta?: (value: number) => string;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const gradientSeed = useId().replace(/:/g, "");
  const stroke = positive ? "var(--terminal-green)" : "var(--terminal-red)";
  const gradientId = `${gradientSeed}-${positive ? "up" : "down"}`;
  const timeRange = range as PortfolioTimeRange;

  const datedSeries = useMemo(() => toDatedSeries(data), [data]);
  const seriesResolution = useMemo(
    () => detectSeriesResolution(datedSeries),
    [datedSeries],
  );
  const chartBuckets = useMemo(
    () => buildChartBucketsForRange(datedSeries, timeRange),
    [datedSeries, timeRange],
  );
  const displaySeries = useMemo(
    () => buildDisplaySeriesForRange(datedSeries, timeRange),
    [datedSeries, timeRange],
  );
  const chartLineType = useMemo(
    () => getChartLineType(timeRange, seriesResolution),
    [seriesResolution, timeRange],
  );
  const bounds = useMemo(() => getSeriesValueBounds(displaySeries), [displaySeries]);
  const { startValue: periodStartValue, endValue: periodEndValue } = useMemo(
    () => getPeriodBoundaryValues(datedSeries, timeRange),
    [datedSeries, timeRange],
  );

  const { selection, isSelecting } = usePortfolioChartRangeSelection({
    containerRef: chartContainerRef,
    buckets: chartBuckets,
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
      chartBuckets,
      displaySeries,
      selection,
      rect,
      PORTFOLIO_CHART_MARGIN,
    );
  }, [chartBuckets, containerSize.height, containerSize.width, displaySeries, selection]);

  const { hover } = usePortfolioChartHover({
    containerRef: chartContainerRef,
    buckets: chartBuckets,
    displaySeries,
    periodStartValue,
    periodEndValue,
    suppressHover: showSelectionUi,
    margin: PORTFOLIO_CHART_MARGIN,
  });

  useEffect(() => {
    const node = chartContainerRef.current;
    if (!node) return;
    const updateSize = () =>
      setContainerSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const hasSeries = displaySeries.length > 0;

  return (
    <div
      ref={chartContainerRef}
      className="relative min-w-0 w-full touch-none cursor-crosshair"
      role="img"
      aria-label={`${ariaLabel}. Click and drag to measure performance between two points.`}
    >
      <div className={cn("min-w-0 w-full overflow-hidden", heightClass)}>
        {hasSeries ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displaySeries} margin={PORTFOLIO_CHART_MARGIN}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                hide
                type="number"
                dataKey="at"
                domain={["dataMin", "dataMax"]}
                scale="linear"
              />
              <YAxis hide domain={[bounds.min, bounds.max]} />
              <Area
                type={chartLineType}
                dataKey="v"
                stroke={stroke}
                strokeWidth={1.8}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-[var(--terminal-muted)]">
            Chart unavailable
          </div>
        )}
      </div>
      {hasSeries && selectionGeometry ? (
        <PortfolioChartSelectionOverlay geometry={selectionGeometry} />
      ) : null}
      {hasSeries && showSelectionUi && selection && selectionGeometry ? (
        <PortfolioChartSelectionTooltip
          timeRange={timeRange}
          selection={selection}
          buckets={chartBuckets}
          geometry={selectionGeometry}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          formatValue={formatDelta ?? formatValue}
        />
      ) : null}
      {hasSeries && hover && !showSelectionUi ? <PortfolioHoverCrosshair hover={hover} /> : null}
      {hasSeries && hover && !showSelectionUi ? (
        <PortfolioHoverTooltip
          hover={hover}
          timeRange={timeRange}
          containerWidth={containerSize.width || chartContainerRef.current?.clientWidth || 0}
          containerHeight={containerSize.height || chartContainerRef.current?.clientHeight || 0}
          periodStartValue={periodStartValue}
          resolution={seriesResolution}
          formatValue={formatValue}
          formatDelta={formatDelta ?? formatValue}
          buckets={chartBuckets}
        />
      ) : null}
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
  const hasChartSeries = data.length > 0;
  const rangeChange = useMemo(() => {
    const start = data[0]?.v;
    const end = data[data.length - 1]?.v;
    if (start == null || end == null || start === 0) {
      return { amount: dayChange, percent: dayChangePercent };
    }
    return { amount: end - start, percent: ((end - start) / Math.abs(start)) * 100 };
  }, [data, dayChange, dayChangePercent]);
  const positive = (rangeChange.amount ?? 0) >= 0;
  const showPerformance = valuationAvailable || hasChartSeries;

  return (
    <section className={cn("min-w-0 space-y-4", className)} aria-label="Portfolio performance">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-[var(--terminal-muted)]">
            {valuationAvailable || hasChartSeries ? "Portfolio value" : "Cash value"}
          </p>
          <MoneyValue value={equityValue} size="xl" className="mt-1 block" />
          {showPerformance ? (
            <div className="mt-2">
              <PriceChange amount={rangeChange.amount} percent={rangeChange.percent} />
            </div>
          ) : null}
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>
      {hasChartSeries ? (
        <InteractiveTerminalChart
          data={data}
          range={range}
          positive={positive}
          heightClass="h-[220px] sm:h-[260px]"
          ariaLabel={`Portfolio chart for ${range}`}
        />
      ) : (
        <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[var(--terminal-border)] text-[13px] text-[var(--terminal-muted)] sm:h-[260px]">
          {valuationAvailable
            ? "Chart unavailable"
            : "Performance chart will return when markets are online"}
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
  formatValue,
  formatDelta,
  /** @deprecated Prefer controlled `range` + `onRangeChange` (URL-synced). */
  initialRange = "1D",
}: {
  seriesByRange: Record<TerminalChartRange, PricePoint[]>;
  positive: boolean;
  className?: string;
  range?: TerminalChartRange;
  onRangeChange?: (range: TerminalChartRange) => void;
  /** Price level formatter (hover absolute). Defaults to portfolio florin 2dp. */
  formatValue?: (value: number) => string;
  /** Price-change formatter (hover delta + drag selection). Defaults to formatValue. */
  formatDelta?: (value: number) => string;
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
        formatValue={formatValue}
        formatDelta={formatDelta}
      />
    </section>
  );
}
