import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  computeHoverChangePercent,
  dedupeTimestamps,
  detectSeriesResolution,
  ensureSortedSeries,
  formatPortfolioChartHoverDate,
  getHoverSnapMode,
  getSeriesValueBounds,
  mapPointerToTimestamp,
  mapValueToPlotY,
  PORTFOLIO_CHART_MARGIN,
  snapHoverToSeries,
  snapPointerToDisplaySeries,
  type PortfolioChartPoint,
  type PortfolioTimeRange,
  type SeriesResolution,
} from "@/lib/account/portfolio-chart-series";
import { florin } from "@/lib/mock-data";
import { pct } from "@/lib/terminal/api";
import { cn } from "@/lib/utils";

export type ChartHoverState = {
  at: number;
  v: number;
  percent: number;
  pixelX: number;
  pixelY: number;
};

type ChartMargin = typeof PORTFOLIO_CHART_MARGIN;

export function PortfolioHoverCrosshair({ hover }: { hover: ChartHoverState }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute z-[1] w-px opacity-85"
        style={{
          left: hover.pixelX,
          top: PORTFOLIO_CHART_MARGIN.top,
          bottom: PORTFOLIO_CHART_MARGIN.bottom,
          background: "var(--gold)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute z-[2] size-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-gold"
        style={{ left: hover.pixelX, top: hover.pixelY }}
      />
    </>
  );
}

export function PortfolioHoverTooltip({
  hover,
  timeRange,
  containerWidth,
  periodStartValue,
  resolution,
  snapMode,
}: {
  hover: ChartHoverState;
  timeRange: PortfolioTimeRange;
  containerWidth: number;
  periodStartValue: number;
  resolution: SeriesResolution;
  snapMode: ReturnType<typeof getHoverSnapMode>;
}) {
  const tooltipWidth = 168;
  const gap = 12;
  const edgePadding = 8;
  const placeOnRight = hover.pixelX + gap + tooltipWidth <= containerWidth - edgePadding;
  const rawLeft = placeOnRight
    ? hover.pixelX + gap
    : hover.pixelX - tooltipWidth - gap;
  const left = Math.max(edgePadding, Math.min(rawLeft, containerWidth - tooltipWidth - edgePadding));

  return (
    <div
      className="pointer-events-none absolute z-10 transition-[left] duration-75 ease-out"
      style={{ left, top: 8 }}
    >
      <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 shadow-sm">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {formatPortfolioChartHoverDate(hover.at, timeRange, { resolution, snapMode })}
        </div>
        <div className="tabular mt-1 text-sm font-semibold text-foreground">{florin(hover.v)}</div>
        <div
          className={cn(
            "tabular mt-0.5 text-xs",
            hover.percent >= 0 ? "ticker-up" : "ticker-down",
          )}
        >
          {hover.v - periodStartValue >= 0 ? "+" : "-"}
          {florin(Math.abs(hover.v - periodStartValue))} · {pct(hover.percent)}
        </div>
      </div>
    </div>
  );
}

export function usePortfolioChartHover({
  containerRef,
  sourceSeries,
  displaySeries,
  periodStartValue,
  periodEndValue,
  timeRange,
  resolution,
  snapMode,
  disabled = false,
  margin = PORTFOLIO_CHART_MARGIN,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  sourceSeries: PortfolioChartPoint[];
  displaySeries: PortfolioChartPoint[];
  periodStartValue: number;
  periodEndValue: number;
  timeRange: PortfolioTimeRange;
  resolution: SeriesResolution;
  snapMode: ReturnType<typeof getHoverSnapMode>;
  disabled?: boolean;
  margin?: ChartMargin;
}) {
  const [hover, setHover] = useState<ChartHoverState | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const periodStartRef = useRef(periodStartValue);
  const periodEndRef = useRef(periodEndValue);

  const sortedSource = useMemo(
    () => dedupeTimestamps(ensureSortedSeries(sourceSeries)),
    [sourceSeries],
  );

  const sortedDisplay = useMemo(
    () => dedupeTimestamps(ensureSortedSeries(displaySeries)),
    [displaySeries],
  );

  const timeSeries = sortedDisplay.length > 0 ? sortedDisplay : sortedSource;

  const valueBounds = useMemo(
    () => getSeriesValueBounds(timeSeries.length > 0 ? timeSeries : sortedSource),
    [sortedSource, timeSeries],
  );

  periodStartRef.current = periodStartValue;
  periodEndRef.current = periodEndValue;

  useEffect(() => {
    setHover(null);
  }, [sortedSource, displaySeries, periodStartValue, periodEndValue, timeRange, snapMode]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateHover = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (timeSeries.length === 0) {
        setHover(null);
        return;
      }

      const plot = {
        left: margin.left,
        top: margin.top,
        width: rect.width - margin.left - margin.right,
        height: rect.height - margin.top - margin.bottom,
      };

      const timeDomain = {
        min: timeSeries[0].at!,
        max: timeSeries[timeSeries.length - 1].at!,
      };

      const localX = clientX - rect.left;
      const pointerAt = mapPointerToTimestamp(localX, plot, timeDomain);
      const { at: cursorAt } = snapPointerToDisplaySeries(sortedDisplay, pointerAt);
      const { v } = snapHoverToSeries(sortedSource, cursorAt, snapMode);
      const timeRatio =
        timeDomain.max === timeDomain.min
          ? 0
          : (cursorAt - timeDomain.min) / (timeDomain.max - timeDomain.min);
      const pixelX = plot.left + timeRatio * plot.width;
      const pixelY = mapValueToPlotY(v, plot, valueBounds);
      const percent = computeHoverChangePercent(periodStartRef.current, v, periodEndRef.current);

      setHover({ at: cursorAt, v, percent, pixelX, pixelY });
    },
    [margin, snapMode, sortedDisplay, sortedSource, timeSeries, valueBounds],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled) return;

    const handlePointerMove = (event: PointerEvent) => {
      pendingRef.current = { clientX: event.clientX, clientY: event.clientY };
      if (rafRef.current != null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        const node = containerRef.current;
        if (!pending || !node) return;
        updateHover(pending.clientX, node.getBoundingClientRect());
      });
    };

    const handlePointerLeave = () => {
      pendingRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setHover(null);
    };

    element.addEventListener("pointermove", handlePointerMove);
    element.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      element.removeEventListener("pointermove", handlePointerMove);
      element.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [containerRef, disabled, updateHover]);

  return { hover };
}
