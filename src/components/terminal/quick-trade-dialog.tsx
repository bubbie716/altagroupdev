"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyValue, PriceChange } from "@/components/terminal/money-value";
import { MarketStatusBadge, SecurityStatusBadge } from "@/components/terminal/market-status";
import { OrderTicket } from "@/components/terminal/order-ticket";
import { CryptoOrderTicket } from "@/components/terminal/crypto-order-ticket";
import { InstrumentKindBadge } from "@/components/terminal/instrument-kind-badge";
import {
  TerminalProcessResult,
  type TerminalProcessSummaryRow,
} from "@/components/terminal/terminal-process-ui";
import {
  SecurityPortfolioDropdown,
} from "@/components/terminal/security-portfolio-picker";
import { SymbolAutocomplete } from "@/components/terminal/symbol-autocomplete";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { useOrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import {
  formatPortfolioOwnerLine,
  formatPortfolioTicketLabel,
  tradeBlockReason,
  type SecurityPortfolioOption,
} from "@/lib/terminal/security-portfolio-picker";
import { resetQuickTradeFields } from "@/lib/terminal/quick-trade";
import { fetchQuickTradeContext, selectTerminalPortfolioFn } from "@/lib/terminal/terminal.functions";
import type { CryptoAssetDetail, CryptoPortfolioBalance } from "@/lib/terminal/crypto/crypto-market-read.service";
import type { CryptoOrderFillResult } from "@/lib/terminal/crypto/crypto-order-types";
import {
  buildCryptoCustomerReceiptRows,
  CRYPTO_FILLED_ORDER_TITLE,
  cryptoFilledOrderSubtitle,
} from "@/lib/terminal/crypto/crypto-customer-review";
import type {
  Holding,
  MarketStatusSnapshot,
  OrderRecord,
  SecurityDetail,
  SecuritySummary,
  TerminalInstrumentKind,
  TerminalPortfolioSummary,
  TseDataSourceMode,
} from "@/lib/terminal/types";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import { cn } from "@/lib/utils";

type QuickTradeContext = {
  mode: TseDataSourceMode;
  marketStatus: MarketStatusSnapshot;
  portfolios: SecurityPortfolioOption[];
  selectedPortfolio: TerminalPortfolioSummary | null;
  security: SecurityDetail | null;
  position: Holding | null;
  buyingPower: number;
  instrumentKind: TerminalInstrumentKind;
  cryptoAsset: CryptoAssetDetail | null;
  cryptoHolding: CryptoPortfolioBalance | null;
  walletPublicId: string | null;
};

type Phase = "form" | "success";

/**
 * Reusable Quick Trade surface: desktop modal / mobile bottom sheet via one Dialog tree
 * (SSR-safe CSS). Portfolio choice uses an inline dropdown (not a nested modal).
 * Optional `initialSymbol` for movers/watchlist/holdings entry points.
 */
export function QuickTradeDialog({
  open,
  onOpenChange,
  initialSymbol,
  initialPortfolios,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill ticker when opening from movers/watchlists/holdings (future). */
  initialSymbol?: string;
  /** Home/dashboard portfolios for an instant picker (enriched on fetch). */
  initialPortfolios?: TerminalPortfolioSummary[];
  onCloseAutoFocus?: () => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchCtx = useServerFn(fetchQuickTradeContext);
  const rememberPortfolio = useServerFn(selectTerminalPortfolioFn);

  const seedPortfolios = useMemo(
    () =>
      (initialPortfolios ?? []).map(
        (portfolio): SecurityPortfolioOption => ({
          ...portfolio,
          buyingPower: 0,
          holdingQuantity: 0,
        }),
      ),
    [initialPortfolios],
  );

  const [phase, setPhase] = useState<Phase>("form");
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const [lastCryptoFill, setLastCryptoFill] = useState<CryptoOrderFillResult | null>(null);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [ctx, setCtx] = useState<QuickTradeContext | null>(null);
  const [portfolios, setPortfolios] = useState<SecurityPortfolioOption[]>(seedPortfolios);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [cryptoPhase, setCryptoPhase] = useState<
    "entry" | "review" | "processing" | "success" | "error"
  >("entry");
  const [stockProcessPhase, setStockProcessPhase] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const orderProcessing =
    cryptoPhase === "processing" || stockProcessPhase === "processing";
  const navigatingAwayRef = useRef(false);
  const openPathRef = useRef<string | null>(null);
  /** Skip the redundant fetch after applying server-resolved portfolioId. */
  const skipFetchForHydratedPortfolioRef = useRef(false);

  const security = ctx?.security ?? null;
  const cryptoAsset = ctx?.cryptoAsset ?? null;
  const isCrypto = ctx?.instrumentKind === "CRYPTO" && Boolean(cryptoAsset);
  const draft = useOrderTicketDraft(
    security?.lastPrice ?? (cryptoAsset ? Number.parseFloat(cryptoAsset.currentPrice) : 0),
  );

  // Crypto is market-only — never leave limit selected from a prior stock.
  useEffect(() => {
    if (!isCrypto) return;
    if (draft.type !== "market") draft.setType("market");
  }, [isCrypto, draft.type, draft.setType]);

  // Close cleanly on route change while open.
  useEffect(() => {
    if (!open) {
      openPathRef.current = null;
      return;
    }
    if (openPathRef.current == null) {
      openPathRef.current = pathname;
      return;
    }
    if (pathname !== openPathRef.current) {
      onOpenChange(false);
    }
  }, [open, pathname, onOpenChange]);

  // Seed picker from Home the moment Quick Trade opens.
  useEffect(() => {
    if (!open) return;
    if (seedPortfolios.length > 0) {
      setPortfolios((prev) => (prev.length > 0 ? prev : seedPortfolios));
    }
  }, [open, seedPortfolios]);

  // Load / refresh context when open, portfolio, or symbol changes.
  useEffect(() => {
    if (!open) return;
    if (skipFetchForHydratedPortfolioRef.current) {
      skipFetchForHydratedPortfolioRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetchCtx({
      data: {
        portfolioId: portfolioId ?? undefined,
        symbol: symbol ?? undefined,
      },
    })
      .then((next) => {
        if (cancelled) return;
        setCtx(next);
        setPortfolios(next.portfolios);
        if (!portfolioId && next.selectedPortfolio?.id) {
          skipFetchForHydratedPortfolioRef.current = true;
          setPortfolioId(next.selectedPortfolio.id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Unable to load trade context");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, portfolioId, symbol, fetchCtx]);

  // Apply initialSymbol when dialog opens.
  useEffect(() => {
    if (!open) return;
    if (initialSymbol?.trim()) {
      setSymbol(initialSymbol.trim().toUpperCase());
    }
  }, [open, initialSymbol]);

  function resetAll() {
    setPhase("form");
    setLastOrder(null);
    setLastCryptoFill(null);
    setSymbol(null);
    setPortfolioId(null);
    setCtx(null);
    setPortfolios(seedPortfolios);
    setLoadError(null);
    setPickerOpen(false);
    setReviewing(false);
    setCryptoPhase("entry");
    setStockProcessPhase("idle");
    skipFetchForHydratedPortfolioRef.current = false;
    const fields = resetQuickTradeFields();
    draft.setSide(fields.side);
    draft.setType(fields.type);
    draft.setQuantity(fields.quantity);
    draft.setLimitPrice(fields.limitPrice);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (orderProcessing) return;
      setPickerOpen(false);
      onOpenChange(false);
      // Reset after close so reopen is fresh; portfolio preference stays server-side.
      resetAll();
      return;
    }
    onOpenChange(true);
  }

  function selectPortfolio(nextId: string) {
    // Optimistic update so the trigger/dropdown feel instant; light refresh follows.
    const option = portfolios.find((p) => p.id === nextId) ?? null;
    if (option) {
      setCtx((prev) =>
        prev
          ? {
              ...prev,
              selectedPortfolio: option,
              buyingPower: option.buyingPower || prev.buyingPower,
            }
          : prev,
      );
    }
    setPickerOpen(false);
    setPortfolioId(nextId);
    // Persist as last-used immediately (also done again by context fetch).
    void rememberPortfolio({ data: nextId }).catch(() => {
      /* context refresh will retry remember */
    });
  }

  function tradeAnother() {
    setPhase("form");
    setLastOrder(null);
    setLastCryptoFill(null);
    setSymbol(null);
    setLoadError(null);
    setReviewing(false);
    setCryptoPhase("entry");
    setStockProcessPhase("idle");
    const fields = resetQuickTradeFields();
    draft.setSide(fields.side);
    draft.setType("market");
    draft.setQuantity(fields.quantity);
    draft.setLimitPrice(fields.limitPrice);
    // portfolioId preserved
  }

  function done() {
    closeThenRun(
      () => {
        onOpenChange(false);
        resetAll();
      },
      () => {
        onCloseAutoFocus?.();
      },
    );
  }

  function viewOrder() {
    if (navigatingAwayRef.current) return;
    navigatingAwayRef.current = true;
    const targetPortfolio = lastOrder?.portfolioId ?? portfolioId ?? undefined;
    closeThenRun(
      () => {
        onOpenChange(false);
        resetAll();
      },
      () => {
        void navigate({
          to: "/terminal/orders",
          search: {
            portfolioId: targetPortfolio,
            status: "all",
            side: "all",
          },
        }).finally(() => {
          navigatingAwayRef.current = false;
        });
      },
    );
  }

  const selectedOption = portfolios.find((p) => p.id === portfolioId) ?? null;
  const portfolioForLabel = selectedOption ?? ctx?.selectedPortfolio ?? null;
  const portfolioLabel = formatPortfolioTicketLabel(portfolioForLabel, { compact: true });
  const portfolioOwnerLine = portfolioForLabel
    ? formatPortfolioOwnerLine(portfolioForLabel)
    : null;
  const blockedReason = selectedOption ? tradeBlockReason(selectedOption) : null;
  const marketClosed =
    ctx?.marketStatus.status === "closed" || ctx?.marketStatus.status === "holiday";
  const mode = ctx?.mode ?? "unavailable";

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          overlayClassName={cn(
            "z-[130] data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
          )}
          className={cn(
            "z-[130] gap-0 border-[var(--terminal-border)] bg-[var(--menu-surface)] p-0 text-[var(--terminal-text)]",
            "data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
            "sm:max-w-md",
            // Mobile: bottom sheet above Terminal chrome (SSR-safe)
            "max-lg:left-0 max-lg:right-0 max-lg:top-auto max-lg:bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] max-lg:max-h-[min(85dvh,calc(100dvh-7.5rem))] max-lg:w-full max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0 max-lg:rounded-t-xl max-lg:rounded-b-none max-lg:overflow-hidden",
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDialogCloseButton(event.currentTarget);
          }}
          onEscapeKeyDown={(event) => {
            if (orderProcessing) {
              event.preventDefault();
              return;
            }
            if (pickerOpen) {
              event.preventDefault();
              setPickerOpen(false);
              return;
            }
            if (reviewing) {
              event.preventDefault();
              setReviewing(false);
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onCloseAutoFocus?.();
          }}
        >
          <DialogHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left sm:px-5 sm:py-4">
            <DialogTitle className="text-[16px] font-medium">
              {phase === "success"
                ? "Order placed"
                : orderProcessing
                  ? "Submitting order"
                  : reviewing
                    ? "Review order"
                    : "Quick Trade"}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[var(--terminal-muted)]">
              {phase === "success"
                ? "Your order was submitted."
                : orderProcessing
                  ? "Please wait while we place your order."
                  : reviewing && !isCrypto
                    ? "Confirm details before submitting. Back keeps your entries."
                    : isCrypto
                      ? "Choose a portfolio and crypto asset. Market orders only."
                      : "Choose a portfolio and security, then review before submitting."}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] max-lg:max-h-[min(70dvh,calc(100dvh-10rem))]">
            {phase === "success" && lastOrder ? (
              <SuccessPanel
                order={lastOrder}
                portfolioLabel={portfolioLabel}
                onViewOrder={viewOrder}
                onTradeAnother={tradeAnother}
                onDone={done}
              />
            ) : phase === "success" && lastCryptoFill ? (
              <CryptoSuccessPanel
                fill={lastCryptoFill}
                portfolioLabel={portfolioLabel}
                onTradeAnother={tradeAnother}
                onDone={done}
                onViewSecurity={() => {
                  if (navigatingAwayRef.current) return;
                  navigatingAwayRef.current = true;
                  const sym = lastCryptoFill.symbol;
                  closeThenRun(
                    () => {
                      onOpenChange(false);
                      resetAll();
                    },
                    () => {
                      void navigate({
                        to: "/terminal/security/$symbol",
                        params: { symbol: sym },
                        search: {
                          range: "1D",
                          portfolioId: portfolioId ?? undefined,
                          instrument: "crypto",
                        },
                      }).finally(() => {
                        navigatingAwayRef.current = false;
                      });
                    },
                  );
                }}
              />
            ) : (
              <div className="space-y-4">
                {mode === "unavailable" && !isCrypto ? (
                  <p
                    role="status"
                    className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 text-[12px] text-[var(--terminal-muted)]"
                  >
                    Stock trading is offline while the Newport TSE is unreachable. Search for an
                    Alta crypto asset (NPFC, NVA, or VLT) to continue.
                  </p>
                ) : null}

                {!reviewing && !orderProcessing ? (
                  <>
                    <div data-portfolio-dropdown="">
                      <SecurityPortfolioDropdown
                        open={pickerOpen}
                        onOpenChange={setPickerOpen}
                        label={portfolioLabel}
                        ownerLine={portfolioOwnerLine}
                        portfolios={portfolios}
                        selectedId={portfolioId}
                        securitySymbol={
                          security?.symbol ?? cryptoAsset?.symbol ?? "this trade"
                        }
                        onSelect={selectPortfolio}
                        compact
                      />
                    </div>

                    <SymbolAutocomplete
                      selected={
                        security
                          ? { symbol: security.symbol, name: security.name }
                          : cryptoAsset
                            ? { symbol: cryptoAsset.symbol, name: cryptoAsset.displayName }
                            : null
                      }
                      onSelect={(row: SecuritySummary) => {
                        setPickerOpen(false);
                        setSymbol(row.symbol);
                        draft.setType("market");
                        draft.setLimitPrice(String(row.lastPrice));
                        if (row.instrumentKind === "CRYPTO") {
                          setReviewing(false);
                        }
                      }}
                      onClear={() => {
                        setSymbol(null);
                      }}
                      disabled={loading}
                    />

                    {isCrypto && cryptoAsset ? (
                      <div className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <MoneyValue
                            value={Number.parseFloat(cryptoAsset.currentPrice)}
                            asPrice
                            size="sm"
                            cryptoSymbol={cryptoAsset.symbol}
                          />
                          <PriceChange
                            amount={
                              cryptoAsset.dayChange == null
                                ? null
                                : Number.parseFloat(cryptoAsset.dayChange)
                            }
                            percent={
                              cryptoAsset.dayChangePercent == null
                                ? null
                                : Number.parseFloat(cryptoAsset.dayChangePercent)
                            }
                            cryptoSymbol={cryptoAsset.symbol}
                          />
                          <InstrumentKindBadge kind="CRYPTO" />
                        </div>
                        <p className="mt-2 text-[12px] text-[var(--terminal-muted)]">
                          {cryptoAsset.tradingContextLabel}
                        </p>
                      </div>
                    ) : security && ctx?.marketStatus ? (
                      <div className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <MoneyValue value={security.lastPrice} asPrice size="sm" />
                          <PriceChange
                            amount={security.dayChange}
                            percent={security.dayChangePercent}
                          />
                          <SecurityStatusBadge status={security.tradingStatus} />
                          <InstrumentKindBadge kind="STOCK" />
                        </div>
                        <div className="mt-2">
                          <MarketStatusBadge
                            status={ctx.marketStatus.status}
                            label={ctx.marketStatus.label}
                          />
                        </div>
                      </div>
                    ) : null}

                    {loadError ? (
                      <p className="text-[12px] text-[var(--terminal-red)]" role="alert">
                        {loadError}
                      </p>
                    ) : null}

                    {loading && !ctx ? (
                      <p className="text-[13px] text-[var(--terminal-muted)]">Loading…</p>
                    ) : null}
                  </>
                ) : null}

                {isCrypto && cryptoAsset ? (
                  <CryptoOrderTicket
                    symbol={cryptoAsset.symbol}
                    assetName={cryptoAsset.displayName}
                    lastPrice={Number.parseFloat(cryptoAsset.currentPrice)}
                    buyingPower={ctx?.buyingPower ?? selectedOption?.buyingPower ?? 0}
                    holdingQuantity={
                      ctx?.cryptoHolding
                        ? Number.parseFloat(ctx.cryptoHolding.quantity)
                        : 0
                    }
                    portfolioId={portfolioId}
                    portfolioLabel={portfolioLabel}
                    canTradeSelected={!blockedReason}
                    tradeBlockedReason={blockedReason}
                    buyDisabled={!cryptoAsset.tradingCapabilities.canBuy}
                    sellDisabled={!cryptoAsset.tradingCapabilities.canSell}
                    statusLabel={cryptoAsset.tradingContextLabel}
                    onRequestPortfolioChange={() => setPickerOpen(true)}
                    hidePortfolioControl
                    suppressInlineSuccess
                    compact
                    className="border-0 bg-transparent p-0"
                    onPhaseChange={setCryptoPhase}
                    onSubmitted={(fill) => {
                      setLastCryptoFill(fill);
                      setPhase("success");
                    }}
                  />
                ) : mode === "unavailable" && symbol ? (
                  <TerminalUnavailableState
                    title="Stock trading unavailable"
                    description="Alta Terminal cannot reach the Newport TSE right now. Choose an Alta crypto asset to trade, or try again when the live market connection is restored."
                  />
                ) : (
                  <OrderTicket
                    security={security}
                    buyingPower={ctx?.buyingPower ?? selectedOption?.buyingPower ?? 0}
                    position={ctx?.position ?? null}
                    mode={ctx?.mode ?? mode}
                    marketClosed={marketClosed}
                    marketStatus={ctx?.marketStatus.status}
                    portfolioId={portfolioId}
                    portfolioLabel={portfolioLabel}
                    canTradeSelected={!blockedReason}
                    tradeBlockedReason={blockedReason}
                    onRequestPortfolioChange={() => setPickerOpen(true)}
                    hidePortfolioControl
                    suppressInlineSuccess
                    confirmPresentation="inline"
                    confirmOpen={reviewing}
                    onConfirmOpenChange={setReviewing}
                    draft={draft}
                    compact
                    className="border-0 bg-transparent p-0"
                    onProcessPhaseChange={setStockProcessPhase}
                    onSubmitted={({ order }) => {
                      setReviewing(false);
                      setStockProcessPhase("idle");
                      setLastOrder(order);
                      setPhase("success");
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuccessPanel({
  order,
  portfolioLabel,
  onViewOrder,
  onTradeAnother,
  onDone,
}: {
  order: OrderRecord;
  portfolioLabel: string | null;
  onViewOrder: () => void;
  onTradeAnother: () => void;
  onDone: () => void;
}) {
  const summary: TerminalProcessSummaryRow[] = [
    { label: "Portfolio", value: portfolioLabel ?? "—" },
    { label: "Side", value: order.side.toUpperCase() },
    { label: "Type", value: order.type },
    { label: "Quantity", value: String(order.quantity) },
    {
      label: "Status",
      value: order.status === "filled" ? "Filled" : order.status,
    },
    { label: "Est. value", value: `ƒ${order.estimatedValue.toFixed(2)}` },
    { label: "Order", value: order.id, mono: true },
  ];

  return (
    <TerminalProcessResult
      kind={order.status === "filled" ? "success" : "pending"}
      title={
        order.status === "filled"
          ? `${order.side === "buy" ? "Bought" : "Sold"} ${order.quantity} ${order.symbol}`
          : `Order accepted · ${order.symbol}`
      }
      summary={summary}
      onDone={onDone}
      onSecondary={onTradeAnother}
      secondaryLabel="New order"
      primaryLabel="View order"
      onPrimary={onViewOrder}
      liveMessage={
        order.status === "filled"
          ? `Order filled. ${order.quantity} ${order.symbol}.`
          : `Order accepted. ${order.id}.`
      }
    />
  );
}

function CryptoSuccessPanel({
  fill,
  portfolioLabel,
  onViewSecurity,
  onTradeAnother,
  onDone,
}: {
  fill: CryptoOrderFillResult;
  portfolioLabel: string | null;
  onViewSecurity: () => void;
  onTradeAnother: () => void;
  onDone: () => void;
}) {
  const summary = buildCryptoCustomerReceiptRows(fill, portfolioLabel);
  const filledSubtitle = cryptoFilledOrderSubtitle(fill);

  return (
    <TerminalProcessResult
      kind="success"
      title={CRYPTO_FILLED_ORDER_TITLE}
      summary={summary}
      onDone={onDone}
      onSecondary={onTradeAnother}
      secondaryLabel="Trade again"
      primaryLabel={`View ${fill.symbol}`}
      onPrimary={onViewSecurity}
      liveMessage={`${CRYPTO_FILLED_ORDER_TITLE}. ${filledSubtitle}.`}
      details={
        <details className="rounded-md border border-[var(--terminal-border)] px-3 py-2 text-[12px] text-[var(--terminal-muted)]">
          <summary className="min-h-11 cursor-pointer list-none font-medium text-[var(--terminal-text)] [&::-webkit-details-marker]:hidden">
            Order details
          </summary>
          <div className="mt-2 space-y-1.5 border-t border-[var(--terminal-border)] pt-2">
            <p>
              <span className="text-[var(--terminal-muted)]">Full reference</span>
            </p>
            <p className="break-all font-mono text-[11px] text-[var(--terminal-text)]">
              {fill.orderId}
            </p>
          </div>
        </details>
      }
    >
      <p className="text-[14px] font-medium text-[var(--terminal-text)]">{filledSubtitle}</p>
    </TerminalProcessResult>
  );
}
