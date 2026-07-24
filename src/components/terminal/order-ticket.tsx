"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  onSubmitted,
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
  onSubmitted?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const previewFn = useServerFn(previewTerminalOrder);
  const submitFn = useServerFn(submitTerminalOrder);
  const [side, setSide] = useState<OrderSide>("buy");
  const [type, setType] = useState<OrderType>("market");
  const [quantity, setQuantity] = useState("1");
  const [limitPrice, setLimitPrice] = useState(String(security.lastPrice));
  const [preview, setPreview] = useState<OrderPreviewResult | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled =
    mode === "unavailable" ||
    security.tradingStatus === "halted" ||
    marketClosed ||
    !portfolioId;

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
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to preview order");
    }
  }

  async function handleConfirm() {
    if (!preview?.ok || !portfolioId) return;
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
          ? `Order filled · ${result.order.quantity} ${security.symbol}`
          : `Order accepted · ${result.order.id}`,
      );
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
      {!compact ? (
        <div>
          <h2 className="text-[13px] font-medium tracking-wide text-[var(--terminal-muted)]">
            Order
          </h2>
          {portfolioLabel ? (
            <p className="mt-1 text-[12px] text-[var(--terminal-text)]">
              Trading from <span className="font-medium">{portfolioLabel}</span>
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[var(--terminal-red)]">No portfolio selected</p>
          )}
        </div>
      ) : portfolioLabel ? (
        <p className="mb-2 text-[11px] text-[var(--terminal-muted)]">
          From <span className="text-[var(--terminal-text)]">{portfolioLabel}</span>
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-[var(--terminal-surface-2)] p-1">
        {(["buy", "sell"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSide(value)}
            className={cn(
              "rounded-md py-2 text-[13px] font-medium capitalize",
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
              "rounded-md py-2 text-[12px] font-medium capitalize",
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
          className="mt-1.5 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5 text-[15px] tabular-nums text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-green)]"
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
            className="mt-1.5 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2.5 text-[15px] tabular-nums text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-green)]"
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
        {position ? (
          <div className="flex justify-between">
            <span>Shares held</span>
            <span className="tabular-nums text-[var(--terminal-text)]">{position.quantity}</span>
          </div>
        ) : null}
      </div>

      {disabled ? (
        <p className="mt-3 text-[12px] text-[var(--terminal-red)]">
          {mode === "unavailable"
            ? "Market connection unavailable"
            : security.tradingStatus === "halted"
              ? "Security is halted"
              : "Market is closed"}
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
          "mt-4 w-full rounded-md py-2.5 text-[14px] font-medium capitalize disabled:cursor-not-allowed disabled:opacity-40",
          side === "buy"
            ? "bg-[var(--terminal-green)] text-black"
            : "bg-[var(--terminal-red)] text-white",
        )}
      >
        Review {side}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm order</DialogTitle>
            <DialogDescription className="text-[var(--terminal-muted)]">
              Review this {side} order for {security.symbol} before submitting.
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-2 text-[13px]">
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
              className="rounded-md border border-[var(--terminal-border)] px-4 py-2 text-[13px]"
              onClick={() => setOpen(false)}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!preview?.ok || submitting}
              onClick={() => void handleConfirm()}
              className={cn(
                "rounded-md px-4 py-2 text-[13px] font-medium disabled:opacity-40",
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
