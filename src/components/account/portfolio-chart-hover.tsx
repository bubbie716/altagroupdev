import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { isPointerDragPastThreshold } from "@/lib/account/portfolio-chart-range-selection";
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
  resolveAllBucketKind,
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
  formatValue = florin,
  formatDelta = florin,
  buckets,
}: {
  hover: ChartHoverState;
  timeRange: PortfolioTimeRange;
  containerWidth: number;
  containerHeight: number;
  periodStartValue: number;
  resolution: SeriesResolution;
  formatValue?: (value: number) => string;
  formatDelta?: (value: number) => string;
  buckets?: PortfolioChartBucket[];
}) {
  const { left, top, transform } = resolveTooltipPosition({
    pixelX: hover.pixelX,
    pixelY: hover.pixelY,
    containerWidth,
    containerHeight,
  });

  const allBucketKind =
    timeRange === "ALL" && buckets && buckets.length > 0
      ? resolveAllBucketKind(buckets[0]!.startAt, buckets[buckets.length - 1]!.endAt)
      : undefined;

  return (
    <div
      className="pointer-events-none absolute z-[2] w-max max-w-[calc(100%-1rem)] transition-[left,top,transform] duration-75 ease-out"
      style={{ left, top, transform }}
    >
      <div className="rounded-lg border border-border-strong bg-surface-2 px-4 py-3 shadow-sm">
        <div className="font-mono text-[10px] uppercase tracking-wider leading-relaxed text-muted-foreground">
          {formatPortfolioChartHoverDate(hover.at, timeRange, { resolution, allBucketKind })}
        </div>
        <div className="tabular mt-1.5 text-sm font-semibold leading-relaxed text-foreground">
          {formatValue(hover.v)}
        </div>
        <div
          className={cn(
            "tabular mt-1 text-xs leading-relaxed",
            hover.percent >= 0 ? "ticker-up" : "ticker-down",
          )}
        >
          {hover.v - periodStartValue >= 0 ? "+" : "-"}
          {formatDelta(Math.abs(hover.v - periodStartValue))} · {pct(hover.percent)}
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
  /** When true, keep the tapped point visible until another interaction or range-drag. */
  const stickyRef = useRef(false);
  const pressRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragged: boolean;
  } | null>(null);

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

  const clearHover = useCallback(() => {
    stickyRef.current = false;
    pendingRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setHover(null);
  }, []);

  const seriesFingerprint = `${buckets.length}:${buckets[0]?.at ?? 0}:${buckets[buckets.length - 1]?.at ?? 0}:${sortedDisplay.length}:${sortedDisplay[0]?.at ?? 0}:${sortedDisplay[sortedDisplay.length - 1]?.at ?? 0}:${periodStartValue}:${periodEndValue}`;

  useEffect(() => {
    clearHover();
  }, [clearHover, seriesFingerprint]);

  useEffect(() => {
    if (suppressHover) clearHover();
  }, [suppressHover, clearHover]);

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
    [buckets, margin, sortedDisplay, valueBounds],
  );

  const scheduleHoverUpdate = useCallback(
    (clientX: number, clientY: number) => {
      pendingRef.current = { clientX, clientY };
      if (rafRef.current != null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingRef.current;
        const node = containerRef.current;
        if (!pending || !node) return;
        updateHover(pending.clientX, node.getBoundingClientRect());
      });
    },
    [containerRef, updateHover],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element || disabled || suppressHover) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pressRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragged: false,
      };
      stickyRef.current = false;
      const node = containerRef.current;
      if (node) updateHover(event.clientX, node.getBoundingClientRect());
    };

    const handlePointerMove = (event: PointerEvent) => {
      const press = pressRef.current;
      if (press && press.pointerId === event.pointerId) {
        if (
          !press.dragged &&
          isPointerDragPastThreshold(press.startX, press.startY, event.clientX, event.clientY)
        ) {
          press.dragged = true;
          stickyRef.current = false;
          // Range selection owns the gesture from here — hide point tooltip.
          clearHover();
          return;
        }
        if (press.dragged) return;
      }

      // Mouse hover (no active press) or press that has not become a drag yet.
      if (!press || press.pointerId !== event.pointerId || !press.dragged) {
        if (press && press.pointerId === event.pointerId) {
          // Finger still down but under threshold — keep the pressed point.
          return;
        }
        stickyRef.current = false;
        scheduleHoverUpdate(event.clientX, event.clientY);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const press = pressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      pressRef.current = null;

      if (press.dragged) return;

      const node = containerRef.current;
      if (!node) return;
      updateHover(event.clientX, node.getBoundingClientRect());
      // Sticky only for touch — mouse hover already tracks without a click.
      stickyRef.current = event.pointerType !== "mouse";
    };

    const handlePointerCancel = (event: PointerEvent) => {
      const press = pressRef.current;
      if (press && press.pointerId === event.pointerId) {
        pressRef.current = null;
      }
      if (!stickyRef.current) clearHover();
    };

    const handlePointerLeave = (event: PointerEvent) => {
      // Sticky tap tooltips must survive finger lift / pointerleave on touch.
      if (stickyRef.current) return;
      if (pressRef.current) return;
      // Leaving into a child still inside the chart should not clear hover.
      const related = event.relatedTarget;
      if (related instanceof Node && element.contains(related)) return;
      clearHover();
    };

    // Capture so hover tracks even when Recharts SVG is the event target.
    element.addEventListener("pointerdown", handlePointerDown);
    element.addEventListener("pointermove", handlePointerMove, { capture: true });
    element.addEventListener("pointerup", handlePointerUp);
    element.addEventListener("pointercancel", handlePointerCancel);
    element.addEventListener("pointerleave", handlePointerLeave);
    // Desktop mouse path — some environments skip pointermove until a click/gesture.
    const handleMouseMove = (event: MouseEvent) => {
      if (pressRef.current) return;
      if (event.buttons !== 0) return;
      stickyRef.current = false;
      scheduleHoverUpdate(event.clientX, event.clientY);
    };
    const handleMouseLeave = (event: MouseEvent) => {
      if (stickyRef.current) return;
      if (pressRef.current) return;
      const related = event.relatedTarget;
      if (related instanceof Node && element.contains(related)) return;
      clearHover();
    };
    element.addEventListener("mousemove", handleMouseMove, { capture: true });
    element.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      element.removeEventListener("pointermove", handlePointerMove, true);
      element.removeEventListener("pointerup", handlePointerUp);
      element.removeEventListener("pointercancel", handlePointerCancel);
      element.removeEventListener("pointerleave", handlePointerLeave);
      element.removeEventListener("mousemove", handleMouseMove, true);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [clearHover, containerRef, disabled, scheduleHoverUpdate, suppressHover, updateHover]);

  return { hover };
}
