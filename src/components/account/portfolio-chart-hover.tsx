import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  computeHoverChangePercent,
  dedupeTimestamps,
  ensureSortedSeries,
  formatPortfolioChartHoverDate,
  getDisplayTimeDomain,
  getSeriesValueBounds,
  mapPointerToTimestamp,
  mapValueToPlotY,
  PORTFOLIO_CHART_MARGIN,
  resolveBucketHoverPoint,
  resolveDisplayLineValue,
  type PortfolioChartBucket,
  type PortfolioChartPoint,
  type PortfolioTimeRange,
  type SeriesResolution,
} from "@/lib/account/portfolio-chart-series";
import { florin } from "@/lib/format/money-display";
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

const TOOLTIP_WIDTH_ESTIMATE = 240;
const TOOLTIP_HEIGHT_ESTIMATE = 88;
const LINE_GAP = 18;
const VERTICAL_GAP = 16;
const TOOLTIP_EDGE_PADDING = 8;
const DOT_SIZE = 10;
const CROSSHAIR_OFFSET = LINE_GAP + DOT_SIZE / 2;

function resolveTooltipPosition({
  pixelX,
  pixelY,
  containerWidth,
  containerHeight,
  margin = PORTFOLIO_CHART_MARGIN,
}: {
  pixelX: number;
  pixelY: number;
  containerWidth: number;
  containerHeight: number;
  margin?: ChartMargin;
}) {
  const plotTop = margin.top;
  const plotBottom = containerHeight - margin.bottom;

  const spaceRight = containerWidth - TOOLTIP_EDGE_PADDING - (pixelX + CROSSHAIR_OFFSET);
  const spaceLeft = pixelX - CROSSHAIR_OFFSET - TOOLTIP_EDGE_PADDING;
  const placeOnRight =
    spaceRight >= TOOLTIP_WIDTH_ESTIMATE || spaceRight >= spaceLeft;

  const anchorX = placeOnRight
    ? pixelX + CROSSHAIR_OFFSET
    : pixelX - CROSSHAIR_OFFSET;

  const spaceAbove = pixelY - plotTop - VERTICAL_GAP;
  const spaceBelow = plotBottom - pixelY - VERTICAL_GAP;
  const preferAbove =
    spaceAbove >= TOOLTIP_HEIGHT_ESTIMATE || spaceAbove >= spaceBelow;

  const anchorY = preferAbove
    ? pixelY - VERTICAL_GAP - DOT_SIZE / 2
    : pixelY + VERTICAL_GAP + DOT_SIZE / 2;

  const transform = `translate(${placeOnRight ? "0" : "-100%"}, ${preferAbove ? "-100%" : "0"})`;

  return { left: anchorX, top: anchorY, transform };
}

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
        className="pointer-events-none absolute z-[3] size-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-gold"
        style={{ left: hover.pixelX, top: hover.pixelY }}
      />
    </>
  );
}

export function PortfolioHoverTooltip({
  hover,
  timeRange,
  containerWidth,
  containerHeight,
  periodStartValue,
  resolution,
}: {
  hover: ChartHoverState;
  timeRange: PortfolioTimeRange;
  containerWidth: number;
  containerHeight: number;
  periodStartValue: number;
  resolution: SeriesResolution;
}) {
  const { left, top, transform } = resolveTooltipPosition({
    pixelX: hover.pixelX,
    pixelY: hover.pixelY,
    containerWidth,
    containerHeight,
  });

  return (
    <div
      className="pointer-events-none absolute z-[2] w-max max-w-[calc(100%-1rem)] transition-[left,top,transform] duration-75 ease-out"
      style={{ left, top, transform }}
    >
      <div className="rounded-lg border border-border-strong bg-surface-2 px-4 py-3 shadow-sm">
        <div className="font-mono text-[10px] uppercase tracking-wider leading-relaxed text-muted-foreground">
          {formatPortfolioChartHoverDate(hover.at, timeRange, { resolution })}
        </div>
        <div className="tabular mt-1.5 text-sm font-semibold leading-relaxed text-foreground">
          {florin(hover.v)}
        </div>
        <div
          className={cn(
            "tabular mt-1 text-xs leading-relaxed",
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
  buckets,
  displaySeries,
  periodStartValue,
  periodEndValue,
  disabled = false,
  suppressHover = false,
  margin = PORTFOLIO_CHART_MARGIN,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  buckets: PortfolioChartBucket[];
  displaySeries: PortfolioChartPoint[];
  periodStartValue: number;
  periodEndValue: number;
  disabled?: boolean;
  suppressHover?: boolean;
  margin?: ChartMargin;
}) {
  const [hover, setHover] = useState<ChartHoverState | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const periodStartRef = useRef(periodStartValue);
  const periodEndRef = useRef(periodEndValue);

  const sortedDisplay = useMemo(
    () => dedupeTimestamps(ensureSortedSeries(displaySeries)),
    [displaySeries],
  );

  const valueBounds = useMemo(
    () => getSeriesValueBounds(sortedDisplay),
    [sortedDisplay],
  );

  periodStartRef.current = periodStartValue;
  periodEndRef.current = periodEndValue;

  useEffect(() => {
    setHover(null);
  }, [buckets, sortedDisplay, periodStartValue, periodEndValue]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateHover = useCallback(
    (clientX: number, rect: DOMRect) => {
      if (buckets.length === 0 || sortedDisplay.length === 0) {
        setHover(null);
        return;
      }

      const plot = {
        left: margin.left,
        top: margin.top,
        width: rect.width - margin.left - margin.right,
        height: rect.height - margin.top - margin.bottom,
      };

      const timeDomain = getDisplayTimeDomain(sortedDisplay);

      const localX = clientX - rect.left;
      const pointerAt = mapPointerToTimestamp(localX, plot, timeDomain);
      const { at: labelAt, v: tooltipV } = resolveBucketHoverPoint(buckets, pointerAt);
      const lineV = resolveDisplayLineValue(sortedDisplay, pointerAt);
      const timeRatio =
        timeDomain.max === timeDomain.min
          ? 0
          : (pointerAt - timeDomain.min) / (timeDomain.max - timeDomain.min);
      const pixelX = plot.left + timeRatio * plot.width;
      const pixelY = mapValueToPlotY(lineV, plot, valueBounds);
      const percent = computeHoverChangePercent(periodStartRef.current, tooltipV, periodEndRef.current);

      setHover({ at: labelAt, v: tooltipV, percent, pixelX, pixelY });
    },
    [buckets, margin, sortedDisplay.length, valueBounds],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled || suppressHover) return;

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
  }, [containerRef, disabled, suppressHover, updateHover]);

  return { hover };
}
