"use client";

/**
 * Shared Terminal crypto order ticket — market-only florin buy / coin sell.
 * Reuses Terminal visual language and progressive CRYPTO consent on submit.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
import { useOptionalProductConsentAction } from "@/components/legal/product-consent-action-controller";
import { executeWithProductConsentResume } from "@/lib/legal/execute-with-product-consent";
import { isConsentCancelledError } from "@/lib/legal/ui-lab-action-consent";
import {
  previewTerminalCryptoOrderFn,
  submitTerminalCryptoOrderFn,
} from "@/lib/terminal/crypto/terminal-crypto-order.functions";
import type {
  CryptoOrderFillResult,
  CryptoOrderPreviewResult,
} from "@/lib/terminal/crypto/crypto-order-types";
import {
  formatCryptoDisplayPriceFromRaw,
  formatCryptoMoney,
  formatCryptoPercent,
  formatCryptoPriceTransition,
  formatCryptoQuantityDisplay,
} from "@/lib/terminal/crypto/crypto-format";
import { resolveCryptoImpactAckState } from "@/lib/terminal/crypto/crypto-impact-ack";
import { cn } from "@/lib/utils";

function newClientKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `crypto-${crypto.randomUUID()}`;
  }
  return `crypto-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CryptoOrderTicket({
  symbol,
  assetName,
  lastPrice,
  buyingPower,
  holdingQuantity,
  portfolioId,
  portfolioLabel,
  canTradeSelected = true,
  tradeBlockedReason = null,
  buyDisabled = false,
  sellDisabled = false,
  statusLabel,
  onRequestPortfolioChange,
  onSubmitted,
  onPhaseChange,
  suppressInlineSuccess = false,
  className,
  compact = false,
  hidePortfolioControl = false,
}: {
  symbol: string;
  assetName: string;
  lastPrice: number;
  buyingPower: number;
  holdingQuantity: number;
  portfolioId: string | null;
  portfolioLabel?: string | null;
  canTradeSelected?: boolean;
  tradeBlockedReason?: string | null;
  buyDisabled?: boolean;
  sellDisabled?: boolean;
  statusLabel?: string | null;
  onRequestPortfolioChange?: () => void;
  onSubmitted?: (result: CryptoOrderFillResult) => void;
  onPhaseChange?: (phase: "entry" | "review" | "processing" | "success" | "error") => void;
  /** Parent shows success UI (e.g. Quick Trade) — skip inline receipt. */
  suppressInlineSuccess?: boolean;
  className?: string;
  compact?: boolean;
  hidePortfolioControl?: boolean;
}) {
  const previewFn = useServerFn(previewTerminalCryptoOrderFn);
  const submitFn = useServerFn(submitTerminalCryptoOrderFn);
  const consentAction = useOptionalProductConsentAction();

  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [grossFlorins, setGrossFlorins] = useState("100");
  const [quantity, setQuantity] = useState("1");
  const [phase, setPhase] = useState<"entry" | "review" | "processing" | "success" | "error">(
    "entry",
  );
  const [preview, setPreview] = useState<CryptoOrderPreviewResult | null>(null);
  const [receipt, setReceipt] = useState<CryptoOrderFillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptHighImpact, setAcceptHighImpact] = useState(false);
  const [clientKey, setClientKey] = useState(newClientKey);
  const [busy, setBusy] = useState(false);
  const impactId = useId();
  const impactHintId = `${impactId}-hint`;

  useEffect(() => {
    setPreview(null);
    setPhase("entry");
    setError(null);
    setReceipt(null);
    setAcceptHighImpact(false);
    setClientKey(newClientKey());
  }, [portfolioId, symbol]);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  useEffect(() => {
    setAcceptHighImpact(false);
  }, [side, grossFlorins, quantity]);

  const disabled =
    !portfolioId ||
    !canTradeSelected ||
    (side === "BUY" && buyDisabled) ||
    (side === "SELL" && sellDisabled);

  const amountLabel = side === "BUY" ? "Florin amount" : "Coin quantity";

  const impactAck = useMemo(() => {
    if (!preview) {
      return resolveCryptoImpactAckState(
        { priceImpactPercent: null, accepted: false },
        impactHintId,
      );
    }
    return resolveCryptoImpactAckState(
      {
        priceImpactPercent: preview.priceImpactPercent,
        requiresHighImpactConfirmation: preview.requiresHighImpactConfirmation,
        accepted: acceptHighImpact,
      },
      impactHintId,
    );
  }, [preview, acceptHighImpact, impactHintId]);

  async function runPreview() {
    if (!portfolioId) {
      setError("Select a portfolio before trading");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await previewFn({
        data: {
          portfolioId,
          symbol,
          side,
          grossFlorins: side === "BUY" ? grossFlorins : undefined,
          quantity: side === "SELL" ? quantity : undefined,
        },
      });
      if (!result.ok || !("preview" in result) || !result.preview) {
        setError(("message" in result && result.message) || "Preview unavailable");
        setPhase("error");
        return;
      }
      setPreview(result.preview);
      setAcceptHighImpact(false);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  async function runSubmit() {
    if (!portfolioId || !preview) return;
    if (!impactAck.submitEnabled) {
      setError("Confirm the high price impact before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    let startedAt = Date.now();
    try {
      if (consentAction) {
        await consentAction.requestConsent(["TERMINAL", "CRYPTO"]);
      }
      setPhase("processing");
      startedAt = Date.now();
      const payload = {
        portfolioId,
        symbol,
        side,
        grossFlorins: side === "BUY" ? grossFlorins : undefined,
        quantity: side === "SELL" ? quantity : undefined,
        clientKey,
        expectedMarketStateVersion: preview.marketStateVersion,
        quoteExpiresAt: preview.quoteExpiresAt,
        quoteFingerprint: preview.quoteFingerprint,
        acceptHighPriceImpact: acceptHighImpact,
      };

      const result = await executeWithProductConsentResume(
        () => submitFn({ data: payload }),
        consentAction,
      );

      if (!result || typeof result !== "object") {
        await waitTerminalProcessMin(startedAt, TERMINAL_PROCESS_MOTION.minProcessingMs);
        setError("Submit failed");
        setPhase("error");
        return;
      }
      if ("ok" in result && result.ok === false) {
        const code = "code" in result ? String(result.code) : "";
        if (code === "QUOTE_EXPIRED" || code === "REQUOTE_REQUIRED") {
          setError(
            ("message" in result && String(result.message)) ||
              "The market changed. Review the updated quote.",
          );
          if ("preview" in result && result.preview) {
            setPreview(result.preview as CryptoOrderPreviewResult);
            setAcceptHighImpact(false);
            setPhase("review");
          } else {
            await runPreview();
          }
          return;
        }
        await waitTerminalProcessMin(startedAt, TERMINAL_PROCESS_MOTION.minProcessingMs);
        setError(("message" in result && String(result.message)) || "Order failed");
        setPhase("error");
        return;
      }

      await waitTerminalProcessMin(startedAt, TERMINAL_PROCESS_MOTION.minProcessingMs);
      const fill = result as CryptoOrderFillResult;
      setReceipt(fill);
      setClientKey(newClientKey());
      if (suppressInlineSuccess) {
        setPhase("entry");
        onSubmitted?.(fill);
        return;
      }
      setPhase("success");
      onSubmitted?.(fill);
    } catch (e) {
      if (isConsentCancelledError(e)) {
        setPhase("review");
        return;
      }
      await waitTerminalProcessMin(startedAt, TERMINAL_PROCESS_MOTION.minProcessingMs);
      setError(e instanceof Error ? e.message : "Order failed");
      setPhase("error");
    } finally {
      setBusy(false);
    }
  }

  function resetToEntry() {
    setPhase("entry");
    setReceipt(null);
    setPreview(null);
    setAcceptHighImpact(false);
    setError(null);
  }

  const successSummary: TerminalProcessSummaryRow[] | undefined = receipt
    ? [
        { label: "Portfolio", value: portfolioLabel ?? "—" },
        {
          label: "Quantity",
          value: formatCryptoQuantityDisplay(receipt.executedQuantity, receipt.symbol),
        },
        { label: "Total", value: formatCryptoMoney(receipt.grossTradeValue) },
        { label: "Fee", value: formatCryptoMoney(receipt.totalFee) },
        {
          label: "Avg price",
          value: formatCryptoDisplayPriceFromRaw(receipt.averageExecutionPrice, receipt.symbol),
        },
        { label: "Cash", value: formatCryptoMoney(receipt.resultingTerminalCash) },
        {
          label: "Holding",
          value: formatCryptoQuantityDisplay(receipt.resultingWalletBalance, receipt.symbol),
        },
        { label: "Wallet", value: receipt.walletPublicId, mono: true },
        { label: "Order", value: receipt.orderId, mono: true },
      ]
    : undefined;

  const impactWarn = useMemo(() => {
    if (!preview) return null;
    return preview.warnings.find((w) => w.code === "HIGH_PRICE_IMPACT") ?? null;
  }, [preview]);

  const submitDisabled = busy || !impactAck.submitEnabled;

  const shellClass = cn(
    "rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-4",
    compact && "p-3",
    className,
  );

  if (phase === "processing") {
    return (
      <div className={shellClass}>
        <TerminalProcessProcessing
          label={side === "BUY" ? "Submitting buy order…" : "Submitting sell order…"}
        />
      </div>
    );
  }

  if (phase === "success" && receipt && !suppressInlineSuccess) {
    return (
      <div className={shellClass}>
        <TerminalProcessResult
          kind="success"
          title={
            receipt.side === "BUY"
              ? `Bought ${formatCryptoQuantityDisplay(receipt.executedQuantity, receipt.symbol)}`
              : `Sold ${formatCryptoQuantityDisplay(receipt.executedQuantity, receipt.symbol)}`
          }
          summary={successSummary}
          onDone={resetToEntry}
          onSecondary={resetToEntry}
          secondaryLabel="New order"
          liveMessage={`Crypto order filled. ${receipt.symbol}.`}
        />
      </div>
    );
  }

  if (phase === "error" && error) {
    return (
      <div className={shellClass}>
        <TerminalProcessError
          title="Order failed"
          message={error}
          onRetry={
            preview
              ? () => {
                  setPhase("review");
                  setError(null);
                }
              : undefined
          }
          onEdit={resetToEntry}
          editLabel="Edit order"
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-[var(--terminal-text)]">Trade {symbol}</p>
          <p className="text-[12px] text-[var(--terminal-muted)]">{assetName}</p>
        </div>
        <span className="rounded-md bg-[var(--terminal-green)]/10 px-2 py-1 text-[11px] text-[var(--terminal-green)]">
          Market order
        </span>
      </div>

      {statusLabel ? (
        <p className="mt-2 text-[12px] text-[var(--terminal-muted)]">{statusLabel}</p>
      ) : null}

      {!hidePortfolioControl ? (
        <div className="mt-3">
          <SecurityPortfolioTrigger
            label={portfolioLabel ?? "Select portfolio"}
            onClick={() => onRequestPortfolioChange?.()}
          />
        </div>
      ) : null}

      {phase === "entry" ? (
        <div className="mt-4 space-y-3">
          <div className="flex gap-1 rounded-md bg-[var(--terminal-bg)] p-1">
            {(["BUY", "SELL"] as const).map((s) => (
              <button
                key={s}
                type="button"
                data-trade-side={s === "BUY" ? "buy" : "sell"}
                disabled={(s === "BUY" && buyDisabled) || (s === "SELL" && sellDisabled)}
                onClick={() => setSide(s)}
                className={cn(
                  "min-h-11 flex-1 rounded-md text-[13px] font-medium",
                  side === s
                    ? s === "BUY"
                      ? "bg-[var(--terminal-green)] text-white"
                      : "bg-[var(--terminal-red)] text-white"
                    : "text-[var(--terminal-muted)]",
                )}
              >
                {s === "BUY" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>

          <label className="block space-y-1.5">
            <span className="text-[12px] text-[var(--terminal-muted)]">{amountLabel}</span>
            <input
              value={side === "BUY" ? grossFlorins : quantity}
              onChange={(e) =>
                side === "BUY" ? setGrossFlorins(e.target.value) : setQuantity(e.target.value)
              }
              inputMode="decimal"
              className="min-h-11 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 text-[14px] outline-none focus:border-[var(--terminal-green)]"
            />
          </label>

          <div className="flex justify-between text-[12px] text-[var(--terminal-muted)]">
            <span>Price</span>
            <MoneyValue value={lastPrice} asPrice cryptoSymbol={symbol} />
          </div>
          <div className="flex justify-between text-[12px] text-[var(--terminal-muted)]">
            <span>{side === "BUY" ? "Buying power" : "Holdings"}</span>
            <span>
              {side === "BUY" ? (
                <MoneyValue value={buyingPower} animateOnChange />
              ) : (
                formatCryptoQuantityDisplay(holdingQuantity, symbol)
              )}
            </span>
          </div>

          {error ? <p className="text-[12px] text-[var(--terminal-red)]">{error}</p> : null}
          {tradeBlockedReason ? (
            <p className="text-[12px] text-[var(--terminal-muted)]">{tradeBlockedReason}</p>
          ) : null}

          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => void runPreview()}
            className="min-h-11 w-full rounded-md bg-[var(--terminal-green)] text-[14px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Reviewing…" : "Review order"}
          </button>
        </div>
      ) : null}

      {phase === "review" && preview ? (
        <div className="mt-4 space-y-3">
          <ReviewRow
            label="Estimated quantity"
            value={formatCryptoQuantityDisplay(preview.estimatedExecutedQuantity, symbol)}
          />
          <ReviewRow label="Gross value" value={formatCryptoMoney(preview.grossTradeValue)} />
          <ReviewRow label="Fee" value={formatCryptoMoney(preview.totalFee)} />
          <ReviewRow
            label="Avg execution"
            value={formatCryptoDisplayPriceFromRaw(preview.averageExecutionPrice, symbol)}
          />
          <ReviewRow
            label="Price before → after"
            value={formatCryptoPriceTransition(preview.priceBefore, preview.priceAfter, symbol)}
          />
          <ReviewRow
            label="Price impact"
            value={formatCryptoPercent(preview.priceImpactPercent, { signed: false })}
          />
          <ReviewRow
            label="Cash after"
            value={formatCryptoMoney(preview.estimatedTerminalCashAfter)}
          />
          <ReviewRow
            label="Wallet after"
            value={formatCryptoQuantityDisplay(preview.estimatedWalletBalanceAfter, symbol)}
          />

          {impactWarn || impactAck.showWarning ? (
            <p
              id={impactAck.requiresAcknowledgement ? undefined : impactHintId}
              className="rounded-md border border-[var(--terminal-red)]/30 bg-[var(--terminal-red)]/5 px-3 py-2 text-[12px] text-[var(--terminal-red)]"
            >
              {impactWarn?.message ??
                `Estimated price impact is ${formatCryptoPercent(preview.priceImpactPercent, { signed: false })}.`}
            </p>
          ) : null}

          {impactAck.requiresAcknowledgement ? (
            <div className="space-y-1.5">
              <label
                htmlFor={impactId}
                className="flex min-h-11 items-start gap-2 text-[12px] text-[var(--terminal-text)]"
              >
                <input
                  id={impactId}
                  type="checkbox"
                  checked={acceptHighImpact}
                  onChange={(e) => setAcceptHighImpact(e.target.checked)}
                  aria-describedby={impactHintId}
                  className="mt-1 size-4"
                />
                <span>I understand this order has high price impact and want to continue.</span>
              </label>
              <p id={impactHintId} className="text-[11px] text-[var(--terminal-muted)]">
                Submit stays disabled until you acknowledge this high-impact order.
              </p>
            </div>
          ) : null}

          {error ? <p className="text-[12px] text-[var(--terminal-red)]">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPhase("entry");
                setPreview(null);
                setError(null);
                setAcceptHighImpact(false);
              }}
              className="min-h-11 flex-1 rounded-md border border-[var(--terminal-border)] text-[13px] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={submitDisabled}
              aria-disabled={submitDisabled}
              aria-describedby={
                impactAck.requiresAcknowledgement && !acceptHighImpact
                  ? impactHintId
                  : undefined
              }
              onClick={() => void runSubmit()}
              className="min-h-11 flex-1 rounded-md bg-[var(--terminal-green)] text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:saturate-50"
            >
              {busy ? "Submitting…" : "Submit order"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <span className="text-[var(--terminal-muted)]">{label}</span>
      <span className={cn("text-right text-[var(--terminal-text)]", mono && "font-mono text-[11px]")}>
        {value}
      </span>
    </div>
  );
}
