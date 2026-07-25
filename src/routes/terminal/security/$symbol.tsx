import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useRef, useState } from "react";
import { SecurityChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { SecurityStatusBadge } from "@/components/terminal/market-status";
import { OrderTicket } from "@/components/terminal/order-ticket";
import { MobileOrderEntry } from "@/components/terminal/mobile-order-entry";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { SecurityPortfolioPicker } from "@/components/terminal/security-portfolio-picker";
import {
  addTerminalWatchlistSymbol,
  fetchTerminalSecurity,
  removeTerminalWatchlistSymbol,
} from "@/lib/terminal/terminal.functions";
import { formatCompactVolume, formatMarketCap, formatTerminalMoney } from "@/lib/terminal/format";
import {
  formatPortfolioTicketLabel,
  tradeBlockReason,
  type SecurityPortfolioOption,
} from "@/lib/terminal/security-portfolio-picker";
import type { OrderSide, TerminalChartRange } from "@/lib/terminal/types";
import { useOrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

export const Route = createFileRoute("/terminal/security/$symbol")({
  validateSearch: (search: Record<string, unknown>) => ({
    range:
      typeof search.range === "string" &&
      ["1D", "1W", "1M", "3M", "1Y", "ALL"].includes(search.range)
        ? (search.range as TerminalChartRange)
        : ("1D" as TerminalChartRange),
    portfolioId: typeof search.portfolioId === "string" ? search.portfolioId : undefined,
  }),
  // Only portfolio changes should reload the route — chart ranges are URL client state.
  loaderDeps: ({ search }) => ({ portfolioId: search.portfolioId }),
  loader: async ({ params, deps }) => {
    const data = await fetchTerminalSecurity({
      data: {
        symbol: params.symbol,
        portfolioId: deps.portfolioId,
      },
    });
    if (!data.security && data.mode !== "unavailable") throw notFound();
    return data;
  },
  head: ({ loaderData, params }) => ({
    meta: [
      {
        title: loaderData?.security
          ? `${loaderData.security.symbol} — Alta Terminal`
          : `${params.symbol.toUpperCase()} — Alta Terminal`,
      },
    ],
  }),
  component: TerminalSecurityPage,
});

function TerminalSecurityPage() {
  const data = Route.useLoaderData();
  const { range } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const addWatch = useServerFn(addTerminalWatchlistSymbol);
  const removeWatch = useServerFn(removeTerminalWatchlistSymbol);
  const [watchBusy, setWatchBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const lastPickerTriggerRef = useRef<HTMLElement | null>(null);
  const pendingTradeFocusSideRef = useRef<OrderSide | null>(null);
  const suppressOrderSheetCloseRef = useRef(false);
  const positionHeadingId = useId();
  const draft = useOrderTicketDraft(data.security?.lastPrice ?? 0);

  useEffect(() => {
    if (orderSheetOpen) return;
    const side = pendingTradeFocusSideRef.current;
    if (!side) return;
    pendingTradeFocusSideRef.current = null;
    const id = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-trade-side="${side}"]`)
        ?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [orderSheetOpen]);

  if (data.mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  const security = data.security;
  if (!security) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <h1 className="text-[20px] font-medium">Unknown symbol</h1>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          We could not find a security for this symbol.
        </p>
      </div>
    );
  }

  const marketClosed =
    data.marketStatus.status === "closed" || data.marketStatus.status === "holiday";
  const portfolios = data.portfolios as SecurityPortfolioOption[];
  const portfolioId = data.selectedPortfolio?.id ?? null;
  const portfolioLabel = formatPortfolioTicketLabel(data.selectedPortfolio);
  const selectedOption = portfolios.find((p) => p.id === portfolioId) ?? null;
  const blockedReason = selectedOption ? tradeBlockReason(selectedOption) : null;

  function openPicker() {
    const active = document.activeElement;
    lastPickerTriggerRef.current =
      active instanceof HTMLElement ? active : null;
    suppressOrderSheetCloseRef.current = true;
    setPickerOpen(true);
  }

  function restorePickerTriggerFocus() {
    const trigger = lastPickerTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus({ preventScroll: true });
    }
    suppressOrderSheetCloseRef.current = false;
  }

  function selectPortfolio(nextId: string) {
    closeThenRun(
      () => setPickerOpen(false),
      () => {
        // Close-autofocus already returned focus to the opener; navigate after paint.
        void navigate({
          search: (prev) => ({
            ...prev,
            portfolioId: nextId,
          }),
        });
      },
    );
  }

  function setChartRange(next: TerminalChartRange) {
    void navigate({
      search: (prev) => ({
        ...prev,
        range: next,
      }),
    });
  }

  function openOrderSheet(side: OrderSide) {
    pendingTradeFocusSideRef.current = side;
    draft.setSide(side);
    setOrderSheetOpen(true);
  }

  const ticketProps = {
    security,
    buyingPower: data.buyingPower,
    position: data.position,
    mode: data.mode,
    marketClosed,
    portfolioId,
    portfolioLabel,
    canTradeSelected: !blockedReason,
    tradeBlockedReason: blockedReason,
    onRequestPortfolioChange: openPicker,
    onSubmitted: () => {
      setOrderSheetOpen(false);
      void invalidateRouteData(router);
    },
    draft,
  };

  return (
    <div className="space-y-5 pb-[5.25rem] max-[359px]:space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:space-y-0 lg:pb-0">
      <div className="space-y-5 max-[359px]:space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2 max-[359px]:gap-1.5 sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-medium tracking-tight max-[359px]:text-[20px] sm:text-[34px]">
                {security.symbol}
              </h1>
              <SecurityStatusBadge status={security.tradingStatus} />
            </div>
            <p className="mt-0.5 truncate text-[13px] text-[var(--terminal-muted)] max-[359px]:text-[12px]">
              {security.name}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2 max-[359px]:mt-1.5 sm:gap-3">
              <MoneyValue value={security.lastPrice} asPrice size="lg" />
              <PriceChange amount={security.dayChange} percent={security.dayChangePercent} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              disabled={watchBusy}
              onClick={() => {
                setWatchBusy(true);
                void (
                  data.onWatchlist
                    ? removeWatch({ data: security.symbol })
                    : addWatch({ data: security.symbol })
                )
                  .then(() => invalidateRouteData(router))
                  .finally(() => setWatchBusy(false));
              }}
              className="min-h-11 rounded-md border border-[var(--terminal-border)] px-3 text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            >
              <span className="max-[359px]:hidden">
                {data.onWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              </span>
              <span className="min-[360px]:hidden">
                {data.onWatchlist ? "Remove" : "Watch"}
              </span>
            </button>
          </div>
        </div>

        <SecurityChart
          seriesByRange={data.historyByRange}
          range={range}
          onRangeChange={setChartRange}
          positive={security.dayChange >= 0}
          className="max-[359px]:space-y-1"
        />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Open" value={formatTerminalMoney(security.open)} />
          <Stat label="High" value={formatTerminalMoney(security.high)} />
          <Stat label="Low" value={formatTerminalMoney(security.low)} />
          <Stat label="Prev close" value={formatTerminalMoney(security.previousClose)} />
          <Stat label="Volume" value={formatCompactVolume(security.volume)} />
          <Stat label="Market cap" value={formatMarketCap(security.marketCap)} />
        </dl>

        <section
          className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4"
          aria-labelledby={positionHeadingId}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                id={positionHeadingId}
                className="text-[13px] text-[var(--terminal-muted)]"
              >
                Your position
              </h2>
              <button
                type="button"
                onClick={openPicker}
                className="mt-1 min-h-11 rounded-sm text-left text-[13px] font-medium text-[var(--terminal-text)] outline-none hover:underline focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40"
                aria-haspopup="dialog"
                aria-label={
                  portfolioLabel
                    ? `Position portfolio: ${portfolioLabel}. Change portfolio.`
                    : "Choose a portfolio to view your position"
                }
              >
                {portfolioLabel ?? "Choose a portfolio"}
              </button>
            </div>
          </div>
          {data.position ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Shares" value={String(data.position.quantity)} />
              <Stat label="Avg cost" value={formatTerminalMoney(data.position.averageCost)} />
              <Stat label="Market value" value={formatTerminalMoney(data.position.marketValue)} />
              <Stat
                label="Total return"
                value={`${formatTerminalMoney(data.position.totalReturn, { signed: true })} (${data.position.totalReturnPercent.toFixed(2)}%)`}
              />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--terminal-muted)]">
              No position in this portfolio
            </p>
          )}
        </section>

        <section>
          <h2 className="text-[15px] font-medium">About</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--terminal-muted)]">
            {security.description}
          </p>
          <p className="mt-2 text-[12px] text-[var(--terminal-muted)]">
            Sector · {security.sector}
          </p>
        </section>
      </div>

      {/*
        Both presentations stay in the SSR tree. CSS toggles visibility so
        server and client markup match; display:none keeps the inactive branch
        out of focus/a11y. Shared `draft` lives above both.
      */}
      <aside className="hidden lg:sticky lg:top-20 lg:block">
        <OrderTicket {...ticketProps} />
      </aside>

      <MobileOrderEntry
        className="lg:hidden"
        open={orderSheetOpen}
        onOpenChange={(open) => {
          if (!open && (pickerOpen || suppressOrderSheetCloseRef.current)) return;
          setOrderSheetOpen(open);
        }}
        onTrade={openOrderSheet}
        ticketProps={ticketProps}
      />

      <SecurityPortfolioPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onCloseAutoFocus={() => {
          restorePickerTriggerFocus();
        }}
        portfolios={portfolios}
        selectedId={portfolioId}
        securitySymbol={security.symbol}
        onSelect={selectPortfolio}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--terminal-border)] px-3 py-2.5">
      <dt className="text-[11px] text-[var(--terminal-muted)]">{label}</dt>
      <dd className="mt-1 text-[13px] tabular-nums">{value}</dd>
    </div>
  );
}
