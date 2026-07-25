"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  SecurityPortfolioPicker,
  SecurityPortfolioTrigger,
} from "@/components/terminal/security-portfolio-picker";
import { SymbolAutocomplete } from "@/components/terminal/symbol-autocomplete";
import { TerminalUnavailableState } from "@/components/terminal/terminal-app-shell";
import { useOrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import {
  formatPortfolioTicketLabel,
  tradeBlockReason,
  type SecurityPortfolioOption,
} from "@/lib/terminal/security-portfolio-picker";
import { resetQuickTradeFields } from "@/lib/terminal/quick-trade";
import { fetchQuickTradeContext } from "@/lib/terminal/terminal.functions";
import type {
  Holding,
  MarketStatusSnapshot,
  OrderRecord,
  SecurityDetail,
  SecuritySummary,
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
};

type Phase = "form" | "success";

/**
 * Reusable Quick Trade surface: desktop modal / mobile bottom sheet via one Dialog tree
 * (SSR-safe CSS, matching SecurityPortfolioPicker). Optional `initialSymbol` for
 * movers/watchlist/holdings entry points.
 */
export function QuickTradeDialog({
  open,
  onOpenChange,
  initialSymbol,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill ticker when opening from movers/watchlists/holdings (future). */
  initialSymbol?: string;
  onCloseAutoFocus?: () => void;
}) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchCtx = useServerFn(fetchQuickTradeContext);

  const [phase, setPhase] = useState<Phase>("form");
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<string | null>(null);
  const [ctx, setCtx] = useState<QuickTradeContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const suppressCloseRef = useRef(false);
  const lastPickerTriggerRef = useRef<HTMLElement | null>(null);
  const navigatingAwayRef = useRef(false);
  const openPathRef = useRef<string | null>(null);

  const security = ctx?.security ?? null;
  const draft = useOrderTicketDraft(security?.lastPrice ?? 0);

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

  // Load / refresh context when open, portfolio, or symbol changes.
  useEffect(() => {
    if (!open) return;
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
        if (!portfolioId && next.selectedPortfolio?.id) {
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
    setSymbol(null);
    setPortfolioId(null);
    setCtx(null);
    setLoadError(null);
    setPickerOpen(false);
    const fields = resetQuickTradeFields();
    draft.setSide(fields.side);
    draft.setType(fields.type);
    draft.setQuantity(fields.quantity);
    draft.setLimitPrice(fields.limitPrice);
  }

  function handleOpenChange(next: boolean) {
    if (!next && (pickerOpen || suppressCloseRef.current)) return;
    if (!next) {
      onOpenChange(false);
      // Reset after close so reopen is fresh; portfolio preference stays server-side.
      resetAll();
      return;
    }
    onOpenChange(true);
  }

  function openPicker() {
    const active = document.activeElement;
    lastPickerTriggerRef.current = active instanceof HTMLElement ? active : null;
    suppressCloseRef.current = true;
    setPickerOpen(true);
  }

  function restorePickerTriggerFocus() {
    const trigger = lastPickerTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus({ preventScroll: true });
    }
    suppressCloseRef.current = false;
  }

  function selectPortfolio(nextId: string) {
    closeThenRun(
      () => setPickerOpen(false),
      () => {
        setPortfolioId(nextId);
      },
    );
  }

  function tradeAnother() {
    setPhase("form");
    setLastOrder(null);
    setSymbol(null);
    setLoadError(null);
    const fields = resetQuickTradeFields();
    draft.setSide(fields.side);
    draft.setType(fields.type);
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

  const portfolios = (ctx?.portfolios ?? []) as SecurityPortfolioOption[];
  const selectedOption = portfolios.find((p) => p.id === portfolioId) ?? null;
  const portfolioLabel = formatPortfolioTicketLabel(
    selectedOption ?? ctx?.selectedPortfolio ?? null,
  );
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
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onCloseAutoFocus?.();
          }}
        >
          <DialogHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left sm:px-5 sm:py-4">
            <DialogTitle className="text-[16px] font-medium">
              {phase === "success" ? "Order placed" : "Quick Trade"}
            </DialogTitle>
            <DialogDescription className="text-[12px] text-[var(--terminal-muted)]">
              {phase === "success"
                ? "Your order was submitted."
                : "Choose a portfolio and security, then review before submitting."}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] max-lg:max-h-[min(70dvh,calc(100dvh-10rem))]">
            {mode === "unavailable" && ctx ? (
              <TerminalUnavailableState
                title="Trading unavailable"
                description="Alta Terminal cannot reach the Newport TSE right now. Quick Trade stays disabled until a live connection is configured."
              />
            ) : phase === "success" && lastOrder ? (
              <SuccessPanel
                order={lastOrder}
                portfolioLabel={portfolioLabel}
                onViewOrder={viewOrder}
                onTradeAnother={tradeAnother}
                onDone={done}
              />
            ) : (
              <div className="space-y-4">
                <SecurityPortfolioTrigger
                  label={portfolioLabel}
                  onClick={openPicker}
                  compact
                />

                <SymbolAutocomplete
                  selected={
                    security
                      ? { symbol: security.symbol, name: security.name }
                      : null
                  }
                  onSelect={(row: SecuritySummary) => {
                    setSymbol(row.symbol);
                    draft.setLimitPrice(String(row.lastPrice));
                  }}
                  onClear={() => {
                    setSymbol(null);
                  }}
                  disabled={loading}
                />

                {security && ctx?.marketStatus ? (
                  <div className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <MoneyValue value={security.lastPrice} asPrice size="sm" />
                      <PriceChange
                        amount={security.dayChange}
                        percent={security.dayChangePercent}
                      />
                      <SecurityStatusBadge status={security.tradingStatus} />
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

                {security && ctx ? (
                  <OrderTicket
                    security={security}
                    buyingPower={ctx.buyingPower}
                    position={ctx.position}
                    mode={ctx.mode}
                    marketClosed={marketClosed}
                    marketStatus={ctx.marketStatus.status}
                    portfolioId={portfolioId}
                    portfolioLabel={portfolioLabel}
                    canTradeSelected={!blockedReason}
                    tradeBlockedReason={blockedReason}
                    onRequestPortfolioChange={openPicker}
                    hidePortfolioControl
                    suppressInlineSuccess
                    draft={draft}
                    compact
                    className="border-0 bg-transparent p-0"
                    onSubmitted={({ order }) => {
                      setLastOrder(order);
                      setPhase("success");
                    }}
                  />
                ) : (
                  <p className="text-[13px] text-[var(--terminal-muted)]">
                    Search and select a ticker to continue.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <SecurityPortfolioPicker
        open={pickerOpen}
        onOpenChange={(next) => {
          setPickerOpen(next);
          if (!next) restorePickerTriggerFocus();
        }}
        onCloseAutoFocus={() => {
          restorePickerTriggerFocus();
        }}
        portfolios={portfolios}
        selectedId={portfolioId}
        securitySymbol={security?.symbol ?? "this trade"}
        onSelect={selectPortfolio}
      />
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
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-3 text-[13px]">
        <p className="font-medium text-[var(--terminal-text)]">
          {order.side === "buy" ? "Bought" : "Sold"} {order.quantity} {order.symbol}
        </p>
        <p className="mt-1 text-[12px] text-[var(--terminal-muted)]">
          {order.type} · {order.status}
          {portfolioLabel ? ` · ${portfolioLabel}` : ""}
        </p>
        <p className="mt-2 tabular-nums text-[var(--terminal-muted)]">
          Est. <MoneyValue value={order.estimatedValue} size="sm" />
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onViewOrder}
          className="min-h-11 w-full rounded-md bg-[var(--terminal-green)] text-[14px] font-medium text-black"
        >
          View order
        </button>
        <button
          type="button"
          onClick={onTradeAnother}
          className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] text-[14px] text-[var(--terminal-text)]"
        >
          Trade another
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 w-full rounded-md text-[14px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
