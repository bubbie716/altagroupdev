import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { SecurityChart } from "@/components/terminal/portfolio-chart";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { SecurityStatusBadge } from "@/components/terminal/market-status";
import { OrderTicket } from "@/components/terminal/order-ticket";
import { CryptoOrderTicket } from "@/components/terminal/crypto-order-ticket";
import { MobileOrderEntry } from "@/components/terminal/mobile-order-entry";
import { MobileTradeActionBar } from "@/components/terminal/mobile-trade-action-bar";
import { ScheduleTradeSheet } from "@/components/terminal/schedule-trade-sheet";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { SecurityPortfolioPicker } from "@/components/terminal/security-portfolio-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addTerminalWatchlistSymbol,
  fetchTerminalSecurity,
  removeTerminalWatchlistSymbol,
} from "@/lib/terminal/terminal.functions";
import { fetchTerminalCryptoSecurityPage } from "@/lib/terminal/crypto/crypto-market.functions";
import { LAUNCH_ASSET_SYMBOLS } from "@/lib/terminal/crypto/crypto-symbols";
import type { CryptoAssetDetail, CryptoPortfolioBalance } from "@/lib/terminal/crypto/crypto-market-read.service";
import {
  formatCompactVolume,
  formatMarketCap,
  formatTerminalMoney,
  formatTerminalPrice,
} from "@/lib/terminal/format";
import {
  formatCryptoMoney,
  formatCryptoPercent,
  formatCryptoPrice,
  formatCryptoQuantityDisplay,
} from "@/lib/terminal/crypto/crypto-format";
import { InstrumentKindBadge } from "@/components/terminal/instrument-kind-badge";
import {
  formatPortfolioTicketLabel,
  tradeBlockReason,
  type SecurityPortfolioOption,
} from "@/lib/terminal/security-portfolio-picker";
import type { OrderSide, PricePoint, TerminalChartRange } from "@/lib/terminal/types";
import { useOrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import { cn } from "@/lib/utils";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";

type InstrumentSearch = "stocks" | "crypto" | undefined;

function isLaunchCryptoSymbol(symbol: string): boolean {
  return (LAUNCH_ASSET_SYMBOLS as readonly string[]).includes(symbol.toUpperCase());
}

type StockSecurityLoaderData = Awaited<ReturnType<typeof fetchTerminalSecurity>> & {
  kind: "stocks";
};

type CryptoSecurityLoaderData = Awaited<
  ReturnType<typeof fetchTerminalCryptoSecurityPage>
> & {
  kind: "crypto";
};

type SecurityLoaderData =
  | StockSecurityLoaderData
  | CryptoSecurityLoaderData
  | { kind: "unavailable"; mode: "unavailable" };

export const Route = createFileRoute("/terminal/security/$symbol")({
  validateSearch: (search: Record<string, unknown>) => ({
    range:
      typeof search.range === "string" &&
      ["1D", "1W", "1M", "3M", "1Y", "ALL"].includes(search.range)
        ? (search.range as TerminalChartRange)
        : ("1D" as TerminalChartRange),
    portfolioId: typeof search.portfolioId === "string" ? search.portfolioId : undefined,
    instrument:
      search.instrument === "crypto" || search.instrument === "stocks"
        ? (search.instrument as "stocks" | "crypto")
        : undefined,
  }),
  // Only portfolio / instrument changes should reload the route — chart ranges are URL client state.
  loaderDeps: ({ search }) => ({
    portfolioId: search.portfolioId,
    instrument: search.instrument as InstrumentSearch,
  }),
  loader: async ({ params, deps }): Promise<SecurityLoaderData> => {
    const symbol = params.symbol.toUpperCase();
    const preferCrypto =
      deps.instrument === "crypto" ||
      (deps.instrument !== "stocks" && isLaunchCryptoSymbol(symbol));

    if (preferCrypto) {
      const crypto = await fetchTerminalCryptoSecurityPage({
        data: { symbol, portfolioId: deps.portfolioId },
      });
      if (crypto.asset) return crypto;
      if (deps.instrument === "crypto") throw notFound();
      // Inferred crypto missing — fall through to stock.
    }

    if (deps.instrument !== "crypto") {
      const stock = await fetchTerminalSecurity({
        data: {
          symbol,
          portfolioId: deps.portfolioId,
        },
      });
      if (stock.mode === "unavailable") {
        return { kind: "unavailable", mode: "unavailable" };
      }
      if (stock.security) {
        return { kind: "stocks", ...stock };
      }

      // Stock miss — try crypto when not explicitly stocks.
      if (deps.instrument !== "stocks") {
        const crypto = await fetchTerminalCryptoSecurityPage({
          data: { symbol, portfolioId: deps.portfolioId },
        });
        if (crypto.asset) return crypto;
      }

      throw notFound();
    }

    throw notFound();
  },
  head: ({ loaderData, params }) => {
    const titleSymbol =
      loaderData && "kind" in loaderData && loaderData.kind === "crypto" && loaderData.asset
        ? loaderData.asset.symbol
        : loaderData && "kind" in loaderData && loaderData.kind === "stocks" && loaderData.security
          ? loaderData.security.symbol
          : params.symbol.toUpperCase();
    return {
      meta: [{ title: `${titleSymbol} — Alta Terminal` }],
    };
  },
  pendingComponent: () => <RoutePendingFallback label="Loading security" />,
  component: TerminalSecurityPage,
});

function TerminalSecurityPage() {
  const data = Route.useLoaderData();

  if (data.kind === "unavailable") {
    return <TerminalUnavailableState />;
  }

  if (data.kind === "crypto") {
    return <CryptoSecurityPage data={data} />;
  }

  if (data.mode === "unavailable") {
    return <TerminalUnavailableState />;
  }

  return <StockSecurityPage data={data} />;
}

function StockSecurityPage({ data }: { data: StockSecurityLoaderData }) {
  const { range } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const addWatch = useServerFn(addTerminalWatchlistSymbol);
  const removeWatch = useServerFn(removeTerminalWatchlistSymbol);
  const [watchBusy, setWatchBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
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
      replace: true,
      resetScroll: false,
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
    marketStatus: data.marketStatus.status,
    portfolioId,
    portfolioLabel,
    canTradeSelected: !blockedReason,
    tradeBlockedReason: blockedReason,
    onRequestPortfolioChange: openPicker,
    onSubmitted: () => {
      setOrderSheetOpen(false);
      void refreshMutationRouteData(router, "terminal");
    },
    draft,
  };

  return (
    <div className="space-y-5 pb-[calc(7.75rem+env(safe-area-inset-bottom,0px))] max-[359px]:space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:space-y-0 lg:pb-0">
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
                  .then(() => refreshMutationRouteData(router, "terminal"))
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
          formatValue={formatTerminalPrice}
          formatDelta={formatTerminalPrice}
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
              <Stat
                label="Market value"
                value={
                  data.position.marketValue == null
                    ? "—"
                    : formatTerminalMoney(data.position.marketValue)
                }
              />
              <Stat
                label="Total return"
                value={
                  data.position.totalReturn == null ||
                  data.position.totalReturnPercent == null
                    ? "—"
                    : `${formatTerminalMoney(data.position.totalReturn, { signed: true })} (${data.position.totalReturnPercent.toFixed(2)}%)`
                }
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

      <aside className="hidden lg:sticky lg:top-20 lg:block space-y-2">
        <OrderTicket {...ticketProps} />
        {portfolioId && !blockedReason ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] px-3 text-[13px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            onClick={() => setScheduleOpen(true)}
          >
            Schedule trade
          </button>
        ) : null}
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

      {portfolioId && data.selectedPortfolio ? (
        <ScheduleTradeSheet
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          portfolioId={portfolioId}
          portfolioName={data.selectedPortfolio.name}
          symbol={security.symbol}
          side={draft.side}
          allowSideEdit
          onCreated={() => {
            void refreshMutationRouteData(router, "terminal");
          }}
        />
      ) : null}

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

function CryptoSecurityPage({ data }: { data: CryptoSecurityLoaderData }) {
  const { range } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSide, setScheduleSide] = useState<"buy" | "sell">("buy");
  const lastPickerTriggerRef = useRef<HTMLElement | null>(null);
  const suppressOrderSheetCloseRef = useRef(false);
  const holdingHeadingId = useId();

  const asset = data.asset;
  if (!asset) {
    return (
      <div className="rounded-lg border border-[var(--terminal-border)] px-4 py-10 text-center">
        <h1 className="text-[20px] font-medium">Unknown crypto asset</h1>
        <p className="mt-2 text-[13px] text-[var(--terminal-muted)]">
          We could not find a crypto instrument for this symbol.
        </p>
      </div>
    );
  }

  const lastPrice = Number.parseFloat(asset.currentPrice);
  const dayChange =
    asset.dayChange == null ? null : Number.parseFloat(asset.dayChange);
  const dayChangePercent =
    asset.dayChangePercent == null ? null : Number.parseFloat(asset.dayChangePercent);
  const portfolios = data.portfolios as SecurityPortfolioOption[];
  const portfolioId = data.selectedPortfolio?.id ?? null;
  const portfolioLabel = formatPortfolioTicketLabel(data.selectedPortfolio);
  const selectedOption = portfolios.find((p) => p.id === portfolioId) ?? null;
  const blockedReason = selectedOption ? tradeBlockReason(selectedOption) : null;
  const tradeable =
    asset.tradingCapabilities.canBuy || asset.tradingCapabilities.canSell;
  const historyByRange = data.historyByRange as Record<TerminalChartRange, PricePoint[]>;

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
        void navigate({
          search: (prev) => ({
            ...prev,
            portfolioId: nextId,
            instrument: "crypto",
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
        instrument: "crypto",
      }),
      replace: true,
      resetScroll: false,
    });
  }

  const ticketCommon = {
    symbol: asset.symbol,
    assetName: asset.displayName,
    lastPrice,
    buyingPower: data.buyingPower,
    holdingQuantity: data.holding ? Number.parseFloat(data.holding.quantity) : 0,
    portfolioId,
    portfolioLabel,
    canTradeSelected: !blockedReason,
    tradeBlockedReason: blockedReason,
    buyDisabled: !asset.tradingCapabilities.canBuy,
    sellDisabled: !asset.tradingCapabilities.canSell,
    statusLabel: undefined,
    onRequestPortfolioChange: openPicker,
    onSubmitted: () => {
      setOrderSheetOpen(false);
      void refreshMutationRouteData(router, "terminal");
    },
  };

  return (
    <div className="space-y-5 pb-[calc(7.75rem+env(safe-area-inset-bottom,0px))] max-[359px]:space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:space-y-0 lg:pb-0">
      <div className="space-y-5 max-[359px]:space-y-3">
        {data.demonstration ? (
          <p className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] px-3 py-2 text-[12px] text-[var(--terminal-muted)]">
            Demonstration data — UI Lab only. Not production market activity.
          </p>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-2 max-[359px]:gap-1.5 sm:gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-medium tracking-tight max-[359px]:text-[20px] sm:text-[34px]">
                {asset.symbol}
              </h1>
              <CryptoStatusPill label={asset.statusLabel} />
              <InstrumentKindBadge kind="CRYPTO" />
            </div>
            <p className="mt-0.5 truncate text-[13px] text-[var(--terminal-muted)] max-[359px]:text-[12px]">
              {asset.displayName}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-2 max-[359px]:mt-1.5 sm:gap-3">
              <MoneyValue value={lastPrice} asPrice size="lg" cryptoSymbol={asset.symbol} />
              <PriceChange
                amount={dayChange}
                percent={dayChangePercent}
                cryptoSymbol={asset.symbol}
              />
            </div>
            <p className="mt-2 text-[12px] text-[var(--terminal-muted)]">
              {asset.tradingContextLabel}
            </p>
          </div>
        </div>

        <SecurityChart
          seriesByRange={historyByRange}
          range={range}
          onRangeChange={setChartRange}
          positive={(dayChange ?? 0) >= 0}
          className="max-[359px]:space-y-1"
          formatValue={(value) => formatCryptoPrice(value, asset.symbol)}
          formatDelta={(value) =>
            formatCryptoPrice(value, asset.symbol, { forChange: true })
          }
        />

        <section
          className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4"
          aria-labelledby={holdingHeadingId}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                id={holdingHeadingId}
                className="text-[13px] text-[var(--terminal-muted)]"
              >
                Your holding
              </h2>
              <button
                type="button"
                onClick={openPicker}
                className="mt-1 min-h-11 rounded-sm text-left text-[13px] font-medium text-[var(--terminal-text)] outline-none hover:underline focus-visible:ring-1 focus-visible:ring-[var(--terminal-green)]/40"
                aria-haspopup="dialog"
                aria-label={
                  portfolioLabel
                    ? `Holding portfolio: ${portfolioLabel}. Change portfolio.`
                    : "Choose a portfolio to view your holding"
                }
              >
                {portfolioLabel ?? "Choose a portfolio"}
              </button>
            </div>
          </div>
          {data.holding && Number.parseFloat(data.holding.quantity) > 0 ? (
            <CryptoHoldingStats holding={data.holding} />
          ) : (
            <p className="mt-3 text-[13px] text-[var(--terminal-muted)]">
              No holding in this portfolio
            </p>
          )}
        </section>

        <section>
          <h2 className="text-[15px] font-medium">About</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--terminal-muted)]">
            {asset.description}
          </p>
          <p className="mt-2 text-[12px] text-[var(--terminal-muted)]">{asset.feeDisclosure}</p>
        </section>
      </div>

      <aside className="hidden lg:sticky lg:top-20 lg:block space-y-2">
        <CryptoOrderTicket {...ticketCommon} />
        <p className="px-1 text-[11px] leading-relaxed text-[var(--terminal-muted)]">
          {asset.feeDisclosure}
        </p>
        {portfolioId && !blockedReason && tradeable ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] px-3 text-[13px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            onClick={() => {
              setScheduleSide(asset.tradingCapabilities.canBuy ? "buy" : "sell");
              setScheduleOpen(true);
            }}
          >
            Schedule trade
          </button>
        ) : null}
      </aside>

      <MobileCryptoOrderEntry
        className="lg:hidden"
        open={orderSheetOpen}
        onOpenChange={(open) => {
          if (!open && (pickerOpen || suppressOrderSheetCloseRef.current)) return;
          setOrderSheetOpen(open);
        }}
        onTrade={(side) => {
          setScheduleSide(side);
          setOrderSheetOpen(true);
        }}
        buyDisabled={!asset.tradingCapabilities.canBuy || Boolean(blockedReason)}
        sellDisabled={!asset.tradingCapabilities.canSell || Boolean(blockedReason)}
        asset={asset}
        ticketProps={ticketCommon}
      />

      {portfolioId && data.selectedPortfolio ? (
        <ScheduleTradeSheet
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          portfolioId={portfolioId}
          portfolioName={data.selectedPortfolio.name}
          symbol={asset.symbol}
          side={scheduleSide}
          allowSideEdit
          instrumentKind="CRYPTO"
          onCreated={() => {
            void refreshMutationRouteData(router, "terminal");
          }}
        />
      ) : null}

      <SecurityPortfolioPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onCloseAutoFocus={() => {
          restorePickerTriggerFocus();
        }}
        portfolios={portfolios}
        selectedId={portfolioId}
        securitySymbol={asset.symbol}
        onSelect={selectPortfolio}
      />
    </div>
  );
}

function CryptoHoldingStats({ holding }: { holding: CryptoPortfolioBalance }) {
  const qty = Number.parseFloat(holding.quantity);
  const avgCost = Number.parseFloat(holding.averageCost);
  const marked = Number.parseFloat(holding.markedValue);
  const totalReturn =
    holding.totalReturn == null ? null : Number.parseFloat(holding.totalReturn);
  const totalReturnPercent =
    holding.totalReturnPercent == null
      ? null
      : Number.parseFloat(holding.totalReturnPercent);

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat
        label="Quantity"
        value={formatCryptoQuantityDisplay(qty, holding.symbol)}
      />
      <Stat
        label="Avg cost"
        value={formatCryptoPrice(avgCost, holding.symbol)}
      />
      <Stat label="Marked value" value={formatCryptoMoney(marked)} />
      <Stat
        label="Total return"
        value={
          totalReturn == null || totalReturnPercent == null
            ? "—"
            : `${formatCryptoMoney(totalReturn, { signed: true })} (${formatCryptoPercent(totalReturnPercent)})`
        }
      />
    </div>
  );
}

function MobileCryptoOrderEntry({
  open,
  onOpenChange,
  onTrade,
  buyDisabled,
  sellDisabled,
  asset,
  ticketProps,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrade: (side: "buy" | "sell") => void;
  buyDisabled: boolean;
  sellDisabled: boolean;
  asset: CryptoAssetDetail;
  ticketProps: ComponentProps<typeof CryptoOrderTicket>;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      {!open ? (
        <MobileTradeActionBar
          onTrade={onTrade}
          disabled={buyDisabled && sellDisabled}
        />
      ) : null}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          overlayClassName={cn(
            "z-[125] data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
          )}
          className={cn(
            "z-[125] gap-0 rounded-t-xl border-[var(--terminal-border)] bg-[var(--menu-surface)] p-0 text-[var(--terminal-text)]",
            "bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] max-h-[min(85dvh,calc(100dvh-7.5rem))] overflow-hidden md:bottom-0",
            "data-[state=open]:animate-none data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDialogCloseButton(event.currentTarget);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <SheetHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left">
            <SheetTitle className="text-[16px] font-medium text-[var(--terminal-text)]">
              Trade {asset.symbol}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[var(--terminal-muted)]">
              Market orders only · {asset.tradingContextLabel}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain p-3 pb-5">
            <CryptoOrderTicket
              {...ticketProps}
              statusLabel={undefined}
              compact
              className="border-0 bg-transparent p-0"
            />
            <p className="mt-3 text-[11px] text-[var(--terminal-muted)]">{asset.feeDisclosure}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CryptoStatusPill({ label }: { label: string }) {
  const halted = label.toLowerCase().includes("halt");
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
        halted
          ? "border-[var(--terminal-red)]/40 text-[var(--terminal-red)]"
          : "border-[var(--terminal-border)] text-[var(--terminal-muted)]",
      )}
    >
      {label}
    </span>
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
