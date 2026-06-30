import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Lock } from "lucide-react";
import { AltaLogo } from "@/components/alta-logo";
import { DiscordSignInButton } from "@/components/auth/auth-gate";
import {
  PortfolioChartSelectionOverlay,
  PortfolioChartSelectionTooltip,
  resolveSelectionGeometry,
  usePortfolioChartRangeSelection,
} from "@/components/account/portfolio-chart-range-selection";
import { isSelectionVisible } from "@/lib/account/portfolio-chart-range-selection";
import {
  PortfolioHoverCrosshair,
  PortfolioHoverTooltip,
  usePortfolioChartHover,
} from "@/components/account/portfolio-chart-hover";
import {
  attachPointDates,
  buildChartBucketsForRange,
  buildDisplaySeriesForRange,
  detectSeriesResolution,
  formatPeriodChangeFromValues,
  getChartLineType,
  getPeriodBoundaryValues,
  getSeriesValueBounds,
  PORTFOLIO_CHART_MARGIN,
  type PortfolioChartPoint,
  type PortfolioTimeRange,
} from "@/lib/account/portfolio-chart-series";
import { florin } from "@/lib/mock-data";
import { pct } from "@/lib/terminal/api";
import { cn } from "@/lib/utils";
import type { AssetAllocationItem } from "@/lib/account/asset-allocation";
import { PortfolioAssetAllocation } from "@/components/account/portfolio-asset-allocation";

export type PortfolioDashboardStat = {
  label: string;
  value: string;
  up?: boolean;
  /** Enables timeframe period-change badge when set with chartSeries or dashboard chartData. */
  currentValue?: number;
  /** Historical series for period change; defaults to the main dashboard chart. */
  chartSeries?: ChartPoint[];
};

type ChartPoint = PortfolioChartPoint;

export type { PortfolioTimeRange };

const TIME_RANGES: PortfolioTimeRange[] = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

const LOCKED_BLUR = "blur-[6px]";

function PeriodChangeBadge({
  label,
  positive,
  locked,
  className,
}: {
  label: string;
  positive: boolean;
  locked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-finance inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] tabular-nums",
        positive
          ? "border-[var(--success)]/25 bg-[var(--success)]/8 text-[var(--success)]"
          : "border-[var(--danger)]/25 bg-[var(--danger)]/8 text-[var(--danger)]",
        locked && LOCKED_BLUR,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function PortfolioDashboard({
  netWorth,
  changeLabel,
  changePositive = true,
  chartData,
  stats,
  assetAllocation,
  currentValue,
  gradientId = "portfolioFill",
  showTimeRange = true,
  defaultTimeRange = "3M",
  headerLabel = "Alta Portfolio · Snapshot",
  locked = false,
  signInRedirect = "/",
}: {
  netWorth: string;
  changeLabel: string;
  changePositive?: boolean;
  chartData: ChartPoint[];
  stats: PortfolioDashboardStat[];
  assetAllocation: AssetAllocationItem[];
  /** Live net worth — anchors period P&L and 1D chart end to the current balance. */
  currentValue?: number;
  gradientId?: string;
  showTimeRange?: boolean;
  defaultTimeRange?: PortfolioTimeRange;
  headerLabel?: string;
  /** When true, sensitive values are blurred with a sign-in overlay. */
  locked?: boolean;
  signInRedirect?: string;
}) {
  const [timeRange, setTimeRange] = useState<PortfolioTimeRange>(defaultTimeRange);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const datedChartData = useMemo(() => attachPointDates(chartData), [chartData]);

  const seriesResolution = useMemo(
    () => detectSeriesResolution(datedChartData),
    [datedChartData],
  );

  const chartBuckets = useMemo(
    () => buildChartBucketsForRange(datedChartData, timeRange, undefined, currentValue),
    [currentValue, datedChartData, timeRange],
  );

  const chartLineType = useMemo(
    () => getChartLineType(timeRange, seriesResolution),
    [seriesResolution, timeRange],
  );

  const displayChart = useMemo(
    () => buildDisplaySeriesForRange(datedChartData, timeRange, undefined, currentValue),
    [currentValue, datedChartData, timeRange],
  );

  const chartValueBounds = useMemo(
    () => getSeriesValueBounds(displayChart),
    [displayChart],
  );

  const { startValue: periodStartValue, endValue: periodEndValue } = useMemo(
    () => getPeriodBoundaryValues(datedChartData, showTimeRange ? timeRange : "ALL", undefined, currentValue),
    [currentValue, datedChartData, showTimeRange, timeRange],
  );

  const periodChange = useMemo(
    () => formatPeriodChangeFromValues(periodStartValue, periodEndValue, florin, pct),
    [periodEndValue, periodStartValue],
  );

  const statPeriodChanges = useMemo(
    () =>
      stats.map((stat) => {
        if (stat.currentValue === undefined) return null;
        const series = stat.chartSeries ?? datedChartData;
        const range = showTimeRange ? timeRange : "ALL";
        const { startValue, endValue } = getPeriodBoundaryValues(
          series,
          range,
          undefined,
          stat.currentValue,
        );
        return formatPeriodChangeFromValues(startValue, endValue, florin, pct);
      }),
    [datedChartData, showTimeRange, stats, timeRange],
  );

  const {
    selection,
    isSelecting,
    clearSelection,
  } = usePortfolioChartRangeSelection({
    containerRef: chartContainerRef,
    buckets: chartBuckets,
    displaySeries: displayChart,
    disabled: locked,
    margin: PORTFOLIO_CHART_MARGIN,
  });

  const showSelectionUi =
    isSelecting && selection != null && isSelectionVisible(selection);
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
    return resolveSelectionGeometry(chartBuckets, displayChart, selection, rect, PORTFOLIO_CHART_MARGIN);
  }, [chartBuckets, containerSize.height, containerSize.width, displayChart, selection]);

  const { hover } = usePortfolioChartHover({
    containerRef: chartContainerRef,
    buckets: chartBuckets,
    displaySeries: displayChart,
    periodStartValue,
    periodEndValue,
    disabled: locked,
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

  const displayChangeLabel = showTimeRange ? periodChange.label : changeLabel;
  const displayChangePositive = showTimeRange ? periodChange.positive : changePositive;

  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl bg-background p-4 sm:p-5">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <AltaLogo className="h-4 w-4 shrink-0" />
          <span className="type-meta truncate">
            {headerLabel}
          </span>
        </div>
        {showTimeRange && (
          <div
            className={cn("hidden gap-1 md:flex", locked && "opacity-60")}
            role="tablist"
            aria-label="Chart time range"
          >
            {TIME_RANGES.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={timeRange === t}
                onClick={() => {
                  clearSelection();
                  setTimeRange(t);
                }}
                className={cn(
                  "rounded px-2 py-0.5 font-mono text-[10px] transition-colors",
                  timeRange === t
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid min-w-0 gap-5 pt-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]",
          locked && "pointer-events-none select-none",
        )}
        aria-hidden={locked || undefined}
      >
        <div className="min-w-0">
          <div className="type-meta">
            Net Worth
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <div
              className={cn(
                "tabular text-2xl font-semibold tracking-tight sm:text-3xl",
                locked && LOCKED_BLUR,
              )}
            >
              {netWorth}
            </div>
            <PeriodChangeBadge
              label={displayChangeLabel}
              positive={displayChangePositive}
              locked={locked}
            />
          </div>
          <div
            ref={chartContainerRef}
            className={cn(
              "relative mt-4 min-w-0 w-full touch-none",
              !locked && "cursor-crosshair",
              locked && LOCKED_BLUR,
            )}
            aria-label="Portfolio chart. Click and drag to measure performance between two points."
          >
            <div className="h-48 min-w-0 w-full overflow-hidden sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayChart} margin={PORTFOLIO_CHART_MARGIN}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis hide type="number" dataKey="at" domain={["dataMin", "dataMax"]} scale="linear" />
                  <YAxis hide domain={[chartValueBounds.min, chartValueBounds.max]} />
                  <Area
                    type={chartLineType}
                    dataKey="v"
                    stroke="var(--gold)"
                    strokeWidth={1.8}
                    fill={`url(#${gradientId})`}
                    isAnimationActive={false}
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {!locked && selectionGeometry ? (
              <PortfolioChartSelectionOverlay geometry={selectionGeometry} />
            ) : null}
            {!locked && showSelectionUi && selection && selectionGeometry ? (
              <PortfolioChartSelectionTooltip
                timeRange={timeRange}
                selection={selection}
                buckets={chartBuckets}
                geometry={selectionGeometry}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
              />
            ) : null}
            {!locked && hover && !showSelectionUi ? (
              <PortfolioHoverCrosshair hover={hover} />
            ) : null}
            {!locked && hover && !showSelectionUi && containerSize.width > 0 && containerSize.height > 0 ? (
              <PortfolioHoverTooltip
                hover={hover}
                timeRange={timeRange}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                periodStartValue={periodStartValue}
                resolution={seriesResolution}
              />
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((k, index) => {
            const statChange = statPeriodChanges[index];
            return (
              <div key={k.label} className="min-w-0 rounded-lg border border-border bg-surface-1 p-3">
                <div className="type-meta-sm">
                  {k.label}
                </div>
                <div
                  className={cn(
                    "tabular mt-1.5 truncate text-base font-semibold",
                    k.up ? "text-[var(--success)]" : "",
                    locked && LOCKED_BLUR,
                  )}
                >
                  {k.value}
                </div>
                {statChange ? (
                  <PeriodChangeBadge
                    label={pct(statChange.percent)}
                    positive={statChange.positive}
                    locked={locked}
                    className="mt-2"
                  />
                ) : null}
              </div>
            );
          })}
          <PortfolioAssetAllocation items={assetAllocation} locked={locked} />
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-background/55 via-background/70 to-background/80 backdrop-blur-[1px]">
          <div className="mx-auto w-full max-w-md px-4 py-8 text-center sm:px-6">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-gold/25 bg-[color-mix(in_oklch,var(--gold)_8%,var(--background))] shadow-sm">
              <Lock className="size-[18px] text-gold" strokeWidth={1.75} aria-hidden />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Sign in to view your portfolio
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Access your net worth, balances, portfolio performance, and more — all in one place.
            </p>
            <div className="mx-auto mt-6 max-w-xs">
              <DiscordSignInButton redirectTo={signInRedirect} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
