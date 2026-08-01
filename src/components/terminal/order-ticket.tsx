"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyValue } from "@/components/terminal/money-value";
import { SecurityPortfolioTrigger } from "@/components/terminal/security-portfolio-picker";
import {
  TERMINAL_PROCESS_MOTION,
  TerminalProcessError,
  TerminalProcessProcessing,
  TerminalProcessResult,
  waitTerminalProcessMin,
  type TerminalProcessSummaryRow,
} from "@/components/terminal/terminal-process-ui";
import type { OrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import { validateOrderPreview } from "@/lib/terminal/order-validation";
import { requireExplicitPortfolioId } from "@/lib/terminal/quick-trade";
import { previewTerminalOrder, submitTerminalOrder } from "@/lib/terminal/terminal.functions";
import type {
  Holding,
  MarketSessionStatus,
  OrderPreviewResult,
  OrderRecord,
  OrderSide,
  OrderType,
  SecurityDetail,
  TseDataSourceMode,
} from "@/lib/terminal/types";
import { cn } from "@/lib/utils";

type ProcessPhase = "idle" | "processing" | "success" | "error";

export function OrderTicket({
  security,
  buyingPower,
  position,
  mode,
  marketClosed,
  marketStatus,
  portfolioId,
  portfolioLabel,
  canTradeSelected = true,
  tradeBlockedReason = null,
  onRequestPortfolioChange,
  onSubmitted,
  onProcessPhaseChange,
  suppressInlineSuccess = false,
  draft,
  className,
  compact = false,
  hidePortfolioControl = false,
  confirmPresentation = "dialog",
  confirmOpen: confirmOpenProp,
  onConfirmOpenChange,
}: {
  /** Null while Quick Trade waits for a ticker — order fields still render. */
  security: SecurityDetail | null;
  buyingPower: number;
  position: Holding | null;
  mode: TseDataSourceMode;
  marketClosed?: boolean;
  /** When set, client Review gating uses full session validation. */
  marketStatus?: MarketSessionStatus;
  portfolioId: string | null;
  portfolioLabel?: string | null;
  canTradeSelected?: boolean;
  tradeBlockedReason?: string | null;
  onRequestPortfolioChange?: () => void;
  onSubmitted?: (result: { order: OrderRecord }) => void;
  onProcessPhaseChange?: (phase: ProcessPhase) => void;
  /** Parent shows success UI (e.g. Quick Trade) — skip inline green message. */
  suppressInlineSuccess?: boolean;
  /** When provided, order inputs are controlled by the parent (mobile sheet + desktop share). */
  draft?: OrderTicketDraft;
  className?: string;
  compact?: boolean;
  /** Parent already renders the portfolio control (Quick Trade). */
  hidePortfolioControl?: boolean;
  /**
   * How to present the post-preview confirmation.
   * - dialog: nested modal (security page)
   * - inline: in-place review step (Quick Trade — no modal stacking)
   */
  confirmPresentation?: "dialog" | "inline";
  /** Controlled confirm/review open state (Quick Trade Escape handling). */
  confirmOpen?: boolean;
  onConfirmOpenChange?: (open: boolean) => void;
}) {
  const previewFn = useServerFn(previewTerminalOrder);
  const submitFn = useServerFn(submitTerminalOrder);
  const [localSide, setLocalSide] = useState<OrderSide>("buy");
  const [localType, setLocalType] = useState<OrderType>("market");
  const [localQuantity, setLocalQuantity] = useState("1");
  const [localLimitPrice, setLocalLimitPrice] = useState(() =>
    security ? String(security.lastPrice) : "",
  );
  const [preview, setPreview] = useState<OrderPreviewResult | null>(null);
  const [uncontrolledConfirmOpen, setUncontrolledConfirmOpen] = useState(false);
  const confirmOpen = confirmOpenProp ?? uncontrolledConfirmOpen;
  const setConfirmOpen = (open: boolean) => {
    onConfirmOpenChange?.(open);
    if (confirmOpenProp === undefined) setUncontrolledConfirmOpen(open);
  };
  const [submitting, setSubmitting] = useState(false);
  const [processPhase, setProcessPhase] = useState<ProcessPhase>("idle");
  const [submittedOrder, setSubmittedOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const side = draft?.side ?? localSide;
  const type = draft?.type ?? localType;
  const quantity = draft?.quantity ?? localQuantity;
  const limitPrice = draft?.limitPrice ?? localLimitPrice;
  const setSide = draft?.setSide ?? setLocalSide;
  const setType = draft?.setType ?? setLocalType;
  const setQuantity = draft?.setQuantity ?? setLocalQuantity;
  const setLimitPrice = draft?.setLimitPrice ?? setLocalLimitPrice;

  // Recalculate against the newly selected portfolio; drop stale preview/confirm.
  // Keep side/type/qty/limit intact.
  useEffect(() => {
    setPreview(null);
    setConfirmOpen(false);
    setError(null);
    setProcessPhase("idle");
    setSubmittedOrder(null);
    // Intentionally omit setConfirmOpen — only invalidate on portfolio/symbol change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, security?.symbol]);

  useEffect(() => {
    onProcessPhaseChange?.(processPhase);
  }, [processPhase, onProcessPhaseChange]);

  const missingPortfolio = !portfolioId;
  const missingSecurity = !security;
  const sessionStatus: MarketSessionStatus =
    marketStatus ?? (marketClosed ? "closed" : "open");
  const disabled =
    mode === "unavailable" ||
    missingSecurity ||
    security?.tradingStatus === "halted" ||
    marketClosed ||
    missingPortfolio ||
    !canTradeSelected;

  const qty = Number(quantity);
  const est = useMemo(() => {
    const lastPrice = security?.lastPrice ?? 0;
    const price = type === "limit" ? Number(limitPrice) || 0 : lastPrice;
    return Number(((Number.isFinite(qty) ? qty : 0) * price).toFixed(2));
  }, [qty, type, limitPrice, security?.lastPrice]);

  const clientValidation = useMemo(() => {
    if (mode === "unavailable") {
      return { ok: false as const, errors: ["Market connection unavailable"] };
    }
    if (!portfolioId) {
      return { ok: false as const, errors: ["Select a portfolio before trading"] };
    }
    if (!canTradeSelected) {
      return {
        ok: false as const,
        errors: [tradeBlockedReason ?? "This portfolio cannot place orders"],
      };
    }
    if (!security) {
      return { ok: false as const, errors: ["Select a security"] };
    }
    return validateOrderPreview({
      order: {
        portfolioId,
        symbol: security.symbol,
        side,
        type,
        quantity: Number.isFinite(qty) ? qty : NaN,
        limitPrice: type === "limit" ? Number(limitPrice) : null,
      },
      security,
      marketStatus: sessionStatus,
      buyingPower,
      holding: position,
    });
  }, [
    mode,
    portfolioId,
    canTradeSelected,
    tradeBlockedReason,
    security,
    side,
    type,
    qty,
    limitPrice,
    sessionStatus,
    buyingPower,
    position,
  ]);

  const reviewBlocked = disabled || !clientValidation.ok;
  const inlineValidationError =
    !clientValidation.ok &&
    portfolioId &&
    canTradeSelected &&
    mode !== "unavailable"
      ? (clientValidation.errors[0] ?? null)
      : null;

  function resetProcess() {
    setProcessPhase("idle");
    setSubmittedOrder(null);
    setError(null);
    setSubmitting(false);
  }

  async function handlePreview() {
    setError(null);
    setProcessPhase("idle");
    setSubmittedOrder(null);
    if (!portfolioId) {
      setError("Select a portfolio before trading");
      onRequestPortfolioChange?.();
      return;
    }
    if (!security) {
      setError("Select a security");
      return;
    }
    if (!canTradeSelected) {
      setError(tradeBlockedReason ?? "This portfolio cannot place orders");
      return;
    }
    if (!clientValidation.ok) {
      setError(clientValidation.errors[0] ?? "Order is not valid");
      return;
    }
    try {
      const explicitPortfolioId = requireExplicitPortfolioId(portfolioId);
      const next = await previewFn({
        data: {
          portfolioId: explicitPortfolioId,
          symbol: security.symbol,
          side,
          type,
          quantity: qty,
          limitPrice: type === "limit" ? Number(limitPrice) : null,
        },
      });
      setPreview(next);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to preview order");
    }
  }

  async function handleConfirm() {
    if (!preview?.ok || !portfolioId || !security || submitting) return;
    if (!canTradeSelected) {
      setError(tradeBlockedReason ?? "This portfolio cannot place orders");
      return;
    }
    setSubmitting(true);
    setError(null);
    setProcessPhase("processing");
    const startedAt = Date.now();
    try {
      const explicitPortfolioId = requireExplicitPortfolioId(portfolioId);
      const result = await submitFn({
        data: {
          portfolioId: explicitPortfolioId,
          symbol: security.symbol,
          side,
          type,
          quantity: qty,
          limitPrice: type === "limit" ? Number(limitPrice) : null,
        },
      });
      await waitTerminalProcessMin(startedAt, TERMINAL_PROCESS_MOTION.minProcessingMs);
      if (!result.ok) {
        setError(result.errors.join(". "));
        setProcessPhase("error");
        return;
      }
      setConfirmOpen(false);
      setSubmittedOrder(result.order);
      if (suppressInlineSuccess) {
        setProcessPhase("idle");
        onSubmitted?.({ order: result.order });
        return;
      }
      setProcessPhase("success");
      onSubmitted?.({ order: result.order });
    } catch (err) {
      await waitTerminalProcessMin(startedAt, TERMINAL_PROCESS_MOTION.minProcessingMs);
      setError(err instanceof Error ? err.message : "Order submission failed");
      setProcessPhase("error");
    } finally {
      setSubmitting(false);
    }
  }

  const successSummary: TerminalProcessSummaryRow[] | undefined = submittedOrder
    ? [
        { label: "Portfolio", value: portfolioLabel ?? "—" },
        { label: "Side", value: submittedOrder.side.toUpperCase() },
        { label: "Type", value: submittedOrder.type },
        { label: "Quantity", value: String(submittedOrder.quantity) },
        {
          label: "Status",
          value: submittedOrder.status === "filled" ? "Filled" : submittedOrder.status,
        },
        {
          label: "Est. value",
          value: `ƒ${submittedOrder.estimatedValue.toFixed(2)}`,
        },
        { label: "Order", value: submittedOrder.id, mono: true },
      ]
    : undefined;

  const confirmSummary = preview ? (
    <OrderConfirmSummary
      preview={preview}
      portfolioLabel={portfolioLabel}
      side={side}
      submitting={submitting}
      canConfirm={Boolean(preview.ok && portfolioId && security && canTradeSelected)}
      onBack={() => setConfirmOpen(false)}
      onConfirm={() => void handleConfirm()}
    />
  ) : null;

  const shellClass = cn(
    "rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4",
    className,
  );

  if (processPhase === "processing") {
    return (
      <div className={shellClass}>
        <TerminalProcessProcessing
          label={side === "buy" ? "Submitting buy order…" : "Submitting sell order…"}
        />
      </div>
    );
  }

  if (processPhase === "success" && submittedOrder && !suppressInlineSuccess) {
    return (
      <div className={shellClass}>
        <TerminalProcessResult
          kind={submittedOrder.status === "filled" ? "success" : "pending"}
          title={
            submittedOrder.status === "filled" ? "Order filled" : "Order accepted"
          }
          summary={successSummary}
          onDone={resetProcess}
          onSecondary={resetProcess}
          secondaryLabel="New order"
          liveMessage={
            submittedOrder.status === "filled"
              ? `Order filled. ${submittedOrder.quantity} ${submittedOrder.symbol}.`
              : `Order accepted. ${submittedOrder.id}.`
          }
        />
      </div>
    );
  }

  if (processPhase === "error" && error) {
    return (
      <div className={shellClass}>
        <TerminalProcessError
          title="Order failed"
          message={error}
          onRetry={() => {
            setProcessPhase("idle");
            setError(null);
            setConfirmOpen(true);
          }}
          onEdit={() => {
            setProcessPhase("idle");
            setError(null);
            setConfirmOpen(false);
            setPreview(null);
          }}
        />
      </div>
    );
  }

  if (confirmPresentation === "inline" && confirmOpen) {
    return (
      <div className={shellClass}>
        <div className="space-y-1">
          <h2 className="text-[15px] font-medium text-[var(--terminal-text)]">Review order</h2>
          <p className="text-[12px] text-[var(--terminal-muted)]">
            Confirm this {side} of {security?.symbol ?? "—"} before submitting.
          </p>
        </div>
        {error ? (
          <p className="mt-3 text-[12px] text-[var(--terminal-red)]" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4">{confirmSummary}</div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {!hidePortfolioControl ? (
        <div className={cn(compact ? "mb-2 space-y-1.5" : "space-y-2")}>
          {!compact ? (
            <h2 className="text-[13px] font-medium tracking-wide text-[var(--terminal-muted)]">
              Order
            </h2>
          ) : null}
          {onRequestPortfolioChange ? (
            <SecurityPortfolioTrigger
              label={portfolioLabel ?? null}
              onClick={onRequestPortfolioChange}
              compact={compact}
            />
          ) : portfolioLabel ? (
            <p className="text-[12px] text-[var(--terminal-text)]">
              Trading from <span className="font-medium">{portfolioLabel}</span>
            </p>
          ) : (
            <p className="text-[12px] text-[var(--terminal-red)]">Choose a portfolio</p>
          )}
        </div>
      ) : null}

      <div
        className={cn(
          "grid grid-cols-2 gap-1 rounded-md bg-[var(--terminal-surface-2)] p-1",
          hidePortfolioControl ? "mt-0" : "mt-3",
        )}
      >
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            className={cn(
              "min-h-11 rounded-md text-[13px] font-medium capitalize",
              side === value
                ? value === "buy"
                  ? "bg-[var(--terminal-green)] text-black"
                  : "bg-[var(--terminal-red)] text-white"
                : "text-[var(--terminal-muted)]",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-[var(--terminal-surface-2)] p-1">
        {(["market", "limit"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={cn(
              "min-h-11 rounded-md text-[12px] font-medium capitalize",
              type === value
                ? "bg-[var(--terminal-bg)] text-[var(--terminal-text)]"
                : "text-[var(--terminal-muted)]",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-[12px] text-[var(--terminal-muted)]">
        Shares
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5 text-[15px] tabular-nums text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-green)]"
        />
      </label>

      {type === "limit" ? (
        <label className="mt-3 block text-[12px] text-[var(--terminal-muted)]">
          Limit price
          <input
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5 text-[15px] tabular-nums text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-green)]"
          />
        </label>
      ) : null}

      <div className="mt-4 space-y-1.5 text-[12px] text-[var(--terminal-muted)]">
        <div className="flex justify-between">
          <span>Est. value</span>
          <MoneyValue value={est} size="sm" />
        </div>
        <div className="flex justify-between">
          <span>Buying power</span>
          <MoneyValue value={buyingPower} size="sm" />
        </div>
        <div className="flex justify-between">
          <span>Shares held</span>
          <span className="tabular-nums text-[var(--terminal-text)]">
            {position ? position.quantity : 0}
          </span>
        </div>
      </div>

      {disabled ? (
        <p className="mt-3 text-[12px] text-[var(--terminal-red)]">
          {mode === "unavailable"
            ? "Market connection unavailable"
            : missingSecurity
              ? "Select a security to review an order"
              : security?.tradingStatus === "halted"
                ? "Security is halted"
                : marketClosed
                  ? "Market is closed"
                  : missingPortfolio
                    ? "Choose a portfolio to review an order"
                    : (tradeBlockedReason ?? "Trading is not available for this portfolio")}
        </p>
      ) : inlineValidationError ? (
        <p className="mt-3 text-[12px] text-[var(--terminal-red)]" role="alert">
          {inlineValidationError}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-[12px] text-[var(--terminal-red)]" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={reviewBlocked || submitting}
        onClick={() => void handlePreview()}
        className={cn(
          "mt-4 min-h-11 w-full rounded-md text-[14px] font-medium capitalize disabled:cursor-not-allowed disabled:opacity-40",
          side === "buy"
            ? "bg-[var(--terminal-green)] text-black"
            : "bg-[var(--terminal-red)] text-white",
        )}
      >
        Review {side}
      </button>

      {confirmPresentation === "dialog" ? (
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="z-[140] border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm order</DialogTitle>
              <DialogDescription className="text-[var(--terminal-muted)]">
                Review this {side} order for {security?.symbol ?? "—"} before submitting.
              </DialogDescription>
            </DialogHeader>
            {confirmSummary}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function OrderConfirmSummary({
  preview,
  portfolioLabel,
  side,
  submitting,
  canConfirm,
  onBack,
  onConfirm,
}: {
  preview: OrderPreviewResult;
  portfolioLabel?: string | null;
  side: OrderSide;
  submitting: boolean;
  canConfirm: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2 text-[13px]">
        <Row label="Portfolio" value={portfolioLabel ?? "—"} />
        <Row label="Side" value={preview.side.toUpperCase()} />
        <Row label="Type" value={preview.type} />
        <Row label="Quantity" value={String(preview.quantity)} />
        {preview.limitPrice != null ? (
          <Row label="Limit" value={<MoneyValue value={preview.limitPrice} asPrice size="sm" />} />
        ) : null}
        <Row label="Est. value" value={<MoneyValue value={preview.estimatedValue} size="sm" />} />
        <Row label="Est. fees" value={<MoneyValue value={preview.estimatedFees} size="sm" />} />
        {preview.warnings.map((w) => (
          <p key={w} className="text-[12px] text-[var(--terminal-muted)]">
            {w}
          </p>
        ))}
        {preview.errors.map((e) => (
          <p key={e} className="text-[12px] text-[var(--terminal-red)]">
            {e}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="min-h-11 rounded-md border border-[var(--terminal-border)] px-4 text-[13px] sm:min-w-[5.5rem]"
          onClick={onBack}
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canConfirm || submitting}
          onClick={onConfirm}
          className={cn(
            "min-h-11 rounded-md px-4 text-[13px] font-medium disabled:opacity-40 sm:min-w-[8rem]",
            side === "buy"
              ? "bg-[var(--terminal-green)] text-black"
              : "bg-[var(--terminal-red)] text-white",
          )}
        >
          {submitting ? "Submitting…" : "Confirm order"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[var(--terminal-muted)]">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
