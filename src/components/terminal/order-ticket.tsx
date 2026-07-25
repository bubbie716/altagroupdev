"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyValue } from "@/components/terminal/money-value";
import { SecurityPortfolioTrigger } from "@/components/terminal/security-portfolio-picker";
import type { OrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import { previewTerminalOrder, submitTerminalOrder } from "@/lib/terminal/terminal.functions";
import type {
  Holding,
  OrderPreviewResult,
  OrderSide,
  OrderType,
  SecurityDetail,
  TseDataSourceMode,
} from "@/lib/terminal/types";
import { cn } from "@/lib/utils";

export function OrderTicket({
  security,
  buyingPower,
  position,
  mode,
  marketClosed,
  portfolioId,
  portfolioLabel,
  canTradeSelected = true,
  tradeBlockedReason = null,
  onRequestPortfolioChange,
  onSubmitted,
  draft,
  className,
  compact = false,
}: {
  security: SecurityDetail;
  buyingPower: number;
  position: Holding | null;
  mode: TseDataSourceMode;
  marketClosed?: boolean;
  portfolioId: string | null;
  portfolioLabel?: string | null;
  canTradeSelected?: boolean;
  tradeBlockedReason?: string | null;
  onRequestPortfolioChange?: () => void;
  onSubmitted?: () => void;
  /** When provided, order inputs are controlled by the parent (mobile sheet + desktop share). */
  draft?: OrderTicketDraft;
  className?: string;
  compact?: boolean;
}) {
  const previewFn = useServerFn(previewTerminalOrder);
  const submitFn = useServerFn(submitTerminalOrder);
  const [localSide, setLocalSide] = useState<OrderSide>("buy");
  const [localType, setLocalType] = useState<OrderType>("market");
  const [localQuantity, setLocalQuantity] = useState("1");
  const [localLimitPrice, setLocalLimitPrice] = useState(String(security.lastPrice));
  const [preview, setPreview] = useState<OrderPreviewResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
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
    setResultMessage(null);
  }, [portfolioId]);

  const missingPortfolio = !portfolioId;
  const disabled =
    mode === "unavailable" ||
    security.tradingStatus === "halted" ||
    marketClosed ||
    missingPortfolio ||
    !canTradeSelected;

  const qty = Number(quantity);
  const est = useMemo(() => {
    const price = type === "limit" ? Number(limitPrice) || 0 : security.lastPrice;
    return Number(((Number.isFinite(qty) ? qty : 0) * price).toFixed(2));
  }, [qty, type, limitPrice, security.lastPrice]);

  async function handlePreview() {
    setError(null);
    setResultMessage(null);
    if (!portfolioId) {
      setError("Select a portfolio before trading");
      onRequestPortfolioChange?.();
      return;
    }
    if (!canTradeSelected) {
      setError(tradeBlockedReason ?? "This portfolio cannot place orders");
      return;
    }
    try {
      const next = await previewFn({
        data: {
          portfolioId,
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
    if (!preview?.ok || !portfolioId) return;
    if (!canTradeSelected) {
      setError(tradeBlockedReason ?? "This portfolio cannot place orders");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitFn({
        data: {
          portfolioId,
          symbol: security.symbol,
          side,
          type,
          quantity: qty,
          limitPrice: type === "limit" ? Number(limitPrice) : null,
        },
      });
      if (!result.ok) {
        setError(result.errors.join(". "));
        return;
      }
      setResultMessage(
        result.order.status === "filled"
          ? `Order filled · ${result.order.quantity} ${security.symbol} · ${portfolioLabel ?? "portfolio"}`
          : `Order accepted · ${result.order.id} · ${portfolioLabel ?? "portfolio"}`,
      );
      setConfirmOpen(false);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4",
        className,
      )}
    >
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

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-[var(--terminal-surface-2)] p-1">
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
            : security.tradingStatus === "halted"
              ? "Security is halted"
              : marketClosed
                ? "Market is closed"
                : missingPortfolio
                  ? "Choose a portfolio to review an order"
                  : (tradeBlockedReason ?? "Trading is not available for this portfolio")}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-[12px] text-[var(--terminal-red)]">{error}</p> : null}
      {resultMessage ? (
        <p className="mt-3 text-[12px] text-[var(--terminal-green)]">{resultMessage}</p>
      ) : null}

      <button
        type="button"
        disabled={disabled}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="z-[140] border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm order</DialogTitle>
            <DialogDescription className="text-[var(--terminal-muted)]">
              Review this {side} order for {security.symbol} before submitting.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-2 text-[13px]">
              <Row label="Portfolio" value={portfolioLabel ?? "—"} />
              <Row label="Side" value={preview.side.toUpperCase()} />
              <Row label="Type" value={preview.type} />
              <Row label="Quantity" value={String(preview.quantity)} />
              {preview.limitPrice != null ? (
                <Row
                  label="Limit"
                  value={<MoneyValue value={preview.limitPrice} asPrice size="sm" />}
                />
              ) : null}
              <Row
                label="Est. value"
                value={<MoneyValue value={preview.estimatedValue} size="sm" />}
              />
              <Row
                label="Est. fees"
                value={<MoneyValue value={preview.estimatedFees} size="sm" />}
              />
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
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md border border-[var(--terminal-border)] px-4 text-[13px]"
              onClick={() => setConfirmOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!preview?.ok || submitting || !portfolioId || !canTradeSelected}
              onClick={() => void handleConfirm()}
              className={cn(
                "min-h-11 rounded-md px-4 text-[13px] font-medium disabled:opacity-40",
                side === "buy"
                  ? "bg-[var(--terminal-green)] text-black"
                  : "bg-[var(--terminal-red)] text-white",
              )}
            >
              {submitting ? "Submitting…" : "Confirm order"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
