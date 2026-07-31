"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MoneyValue } from "@/components/terminal/money-value";
import { useOptionalProductConsentAction } from "@/components/legal/product-consent-action-controller";
import { executeWithProductConsentResume } from "@/lib/legal/execute-with-product-consent";
import { isConsentCancelledError } from "@/lib/legal/ui-lab-action-consent";
import {
  getUiLabAcceptedOverlaySnapshot,
  getUiLabProductConsentScenario,
} from "@/lib/legal/ui-lab-product-consent";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { isTerminalCryptoSymbol } from "@/lib/terminal/crypto/crypto-instrument";
import { TERMINAL_SCHEDULED_TRADE_UTC_HELP } from "@/lib/terminal/scheduled-trade-schedule";
import {
  createScheduledTradeFn,
  previewScheduledTradeFn,
} from "@/lib/terminal/scheduled-trade.functions";
import type {
  CreateScheduledTradeInput,
  ScheduledTradeDetail,
  ScheduledTradeFrequency,
  ScheduledTradePreviewResult,
} from "@/lib/terminal/scheduled-trade-types";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import { cn } from "@/lib/utils";

type Step = "details" | "review" | "awaiting_consent" | "submitting" | "success" | "error";

const inputClass =
  "mt-1 w-full rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 text-sm min-h-11";

/** Parse datetime-local as an explicit UTC instant (V1 schedule policy). */
function utcLocalInputToIso(value: string): string {
  if (!value) return "";
  const normalized = value.length === 16 ? `${value}:00` : value;
  return `${normalized}.000Z`;
}

function defaultStartLocalUtc(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function ScheduleTradeSheet({
  open,
  onOpenChange,
  portfolioId,
  portfolioName,
  symbol: symbolProp,
  side: sideProp,
  allowSymbolEdit = false,
  allowSideEdit = true,
  defaultQuantity,
  defaultFlorinAmount,
  instrumentKind: instrumentKindProp,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  portfolioName: string;
  symbol: string;
  side: "buy" | "sell";
  allowSymbolEdit?: boolean;
  allowSideEdit?: boolean;
  defaultQuantity?: number;
  defaultFlorinAmount?: number;
  instrumentKind?: "STOCK" | "CRYPTO";
  onCreated?: (detail: ScheduledTradeDetail) => void;
}) {
  const previewFn = useServerFn(previewScheduledTradeFn);
  const createFn = useServerFn(createScheduledTradeFn);
  const consentAction = useOptionalProductConsentAction();
  const [isNarrow, setIsNarrow] = useState(false);

  const [step, setStep] = useState<Step>("details");
  const [symbol, setSymbol] = useState(symbolProp);
  const [side, setSide] = useState<"buy" | "sell">(sideProp);
  const [quantity, setQuantity] = useState(defaultQuantity ?? 1);
  const [florinAmount, setFlorinAmount] = useState(defaultFlorinAmount ?? 100);
  const [scheduleType, setScheduleType] = useState<"one_time" | "recurring">("one_time");
  const [frequency, setFrequency] = useState<ScheduledTradeFrequency>("weekly");
  const [startLocal, setStartLocal] = useState(defaultStartLocalUtc);
  const [endLocal, setEndLocal] = useState("");
  const [preview, setPreview] = useState<ScheduledTradePreviewResult | null>(null);
  const [result, setResult] = useState<ScheduledTradeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCrypto =
    instrumentKindProp === "CRYPTO" ||
    isTerminalCryptoSymbol(symbol) ||
    preview?.instrumentKind === "CRYPTO";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSymbol(symbolProp);
    setSide(sideProp);
    setQuantity(defaultQuantity ?? 1);
    setFlorinAmount(defaultFlorinAmount ?? 100);
  }, [open, symbolProp, sideProp, defaultQuantity, defaultFlorinAmount]);

  const payload = useMemo((): CreateScheduledTradeInput => {
    const crypto = instrumentKindProp === "CRYPTO" || isTerminalCryptoSymbol(symbol);
    return {
      portfolioId,
      symbol,
      side,
      quantity: crypto && side === "buy" ? 0 : quantity,
      florinAmount: crypto && side === "buy" ? florinAmount : null,
      instrumentKind: crypto ? "CRYPTO" : "STOCK",
      sizingMode: crypto ? (side === "buy" ? "FLORIN_AMOUNT" : "QUANTITY") : "QUANTITY",
      maxPriceImpactPercent: crypto ? 10 : undefined,
      scheduleType,
      frequency: scheduleType === "recurring" ? frequency : null,
      startAt: utcLocalInputToIso(startLocal),
      endAt: endLocal ? utcLocalInputToIso(endLocal) : null,
    };
  }, [
    portfolioId,
    symbol,
    side,
    quantity,
    florinAmount,
    instrumentKindProp,
    scheduleType,
    frequency,
    startLocal,
    endLocal,
  ]);

  const reset = useCallback(() => {
    setStep("details");
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  async function runPreview() {
    setError(null);
    try {
      const nextPreview = await previewFn({ data: payload });
      setPreview(nextPreview);
      if (!nextPreview.ok) {
        setError(nextPreview.errors[0] ?? "Unable to preview schedule.");
        return;
      }
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Preview failed.");
      setStep("error");
    }
  }

  async function runSubmit() {
    setError(null);
    const crypto = payload.instrumentKind === "CRYPTO";
    try {
      if (consentAction) {
        setStep("awaiting_consent");
        await consentAction.requestConsent(crypto ? ["TERMINAL", "CRYPTO"] : ["TERMINAL"]);
      }
      setStep("submitting");
      const created = await executeWithProductConsentResume(async () => {
        return createFn({
          data: {
            ...payload,
            uiLabScenario: isUiLabMode() ? "success" : undefined,
            uiLabProductConsentScenario: getUiLabProductConsentScenario(),
            uiLabAcceptedOverlay: getUiLabAcceptedOverlaySnapshot(
              getUiLabProductConsentScenario(),
            ),
          },
        });
      }, consentAction);
      setResult(created);
      setStep("success");
      onCreated?.(created);
    } catch (err) {
      if (isConsentCancelledError(err)) {
        setStep("review");
        return;
      }
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Submit failed.");
      setStep("error");
    }
  }

  const sizeLabel =
    isCrypto && side === "buy"
      ? `ƒ${florinAmount}`
      : `${isCrypto ? quantity : quantity}${isCrypto ? "" : " sh"}`;

  const body = (
    <div className="space-y-4 text-[13px]">
      {step === "details" ? (
        <>
          {allowSymbolEdit ? (
            <label className="block">
              <span className="text-[var(--terminal-muted)]">Symbol</span>
              <input
                className={cn(inputClass, "uppercase")}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                autoCapitalize="characters"
              />
            </label>
          ) : null}
          {allowSideEdit ? (
            <div className="flex gap-2">
              {(["buy", "sell"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-[12px] capitalize min-h-11",
                    side === value
                      ? value === "buy"
                        ? "bg-[var(--terminal-green)] text-black"
                        : "bg-[var(--terminal-red)] text-white"
                      : "border border-[var(--terminal-border)] text-[var(--terminal-muted)]",
                  )}
                  onClick={() => setSide(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          ) : null}
          {isCrypto && side === "buy" ? (
            <label className="block">
              <span className="text-[var(--terminal-muted)]">Florin amount</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                className={inputClass}
                value={florinAmount}
                onChange={(e) => setFlorinAmount(Number(e.target.value))}
              />
            </label>
          ) : (
            <label className="block">
              <span className="text-[var(--terminal-muted)]">
                {isCrypto ? "Coin quantity" : "Whole shares"}
              </span>
              <input
                type="number"
                min={isCrypto ? 0.00000001 : 1}
                step={isCrypto ? "any" : 1}
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
          )}
          {isCrypto ? (
            <p className="text-[11px] text-[var(--terminal-muted)]">
              Market orders only. Automated attempts skip if price impact is 10% or higher.
            </p>
          ) : null}
          <div className="flex gap-2">
            {(["one_time", "recurring"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-[12px] min-h-11",
                  scheduleType === type
                    ? "bg-[var(--terminal-surface-2)]"
                    : "border border-[var(--terminal-border)] text-[var(--terminal-muted)]",
                )}
                onClick={() => setScheduleType(type)}
              >
                {type === "one_time" ? "One time" : "Recurring"}
              </button>
            ))}
          </div>
          {scheduleType === "recurring" ? (
            <label className="block">
              <span className="text-[var(--terminal-muted)]">Frequency</span>
              <select
                className={inputClass}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduledTradeFrequency)}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every two weeks</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          ) : null}
          <label className="block">
            <span className="text-[var(--terminal-muted)]">Start date and time (UTC)</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </label>
          {scheduleType === "recurring" ? (
            <label className="block">
              <span className="text-[var(--terminal-muted)]">End date (optional, UTC)</span>
              <input
                type="datetime-local"
                className={inputClass}
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </label>
          ) : null}
          <p className="text-[11px] leading-relaxed text-[var(--terminal-muted)]">
            {TERMINAL_SCHEDULED_TRADE_UTC_HELP}
          </p>
          {error ? <p className="text-[var(--terminal-red)]">{error}</p> : null}
          <button
            type="button"
            className="w-full rounded-md bg-[var(--terminal-accent)] px-4 py-2 text-sm font-medium min-h-11"
            onClick={() => void runPreview()}
          >
            Review schedule
          </button>
        </>
      ) : null}

      {step === "review" && preview ? (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] text-[var(--terminal-muted)]">Order</dt>
              <dd>
                Market · {preview.side.toUpperCase()}{" "}
                {preview.instrumentKind === "CRYPTO" && preview.sizingMode === "FLORIN_AMOUNT"
                  ? `ƒ${preview.florinAmount}`
                  : preview.quantity}{" "}
                {preview.symbol}
                {preview.instrumentKind === "CRYPTO" ? " · Crypto" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--terminal-muted)]">Portfolio</dt>
              <dd>{portfolioName}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--terminal-muted)]">Schedule</dt>
              <dd>
                {preview.scheduleType === "one_time"
                  ? "One time"
                  : `Recurring · ${preview.frequency ?? ""}`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[var(--terminal-muted)]">Est. value</dt>
              <dd>
                {preview.estimatedValue != null ? (
                  <MoneyValue value={preview.estimatedValue} size="sm" />
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] text-[var(--terminal-muted)]">First attempt (UTC)</dt>
              <dd>{new Date(preview.startAt).toUTCString()}</dd>
            </div>
          </dl>
          <ul className="space-y-1.5 rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] p-3 text-[11px] leading-relaxed text-[var(--terminal-muted)]">
            <li>Estimated value uses the current indicative price and is not reserved or guaranteed.</li>
            <li>
              Price, buying power, holdings, permissions, market availability, and consent are checked
              again at each attempt.
            </li>
            {preview.instrumentKind === "CRYPTO" ? (
              <li>
                Automated crypto attempts skip when estimated price impact is{" "}
                {preview.maxPriceImpactPercent}% or higher.
              </li>
            ) : null}
            <li>An attempt may be skipped, delayed, rejected, or failed.</li>
            <li>Cancelling does not reverse an order already submitted or executed.</li>
            <li>{TERMINAL_SCHEDULED_TRADE_UTC_HELP}</li>
          </ul>
          {preview.warnings.map((w) => (
            <p key={w} className="text-[12px] text-[var(--terminal-muted)]">
              {w}
            </p>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md border border-[var(--terminal-border)] px-3 py-2 min-h-11"
              onClick={() => setStep("details")}
            >
              Back
            </button>
            <button
              type="button"
              className="flex-1 rounded-md bg-[var(--terminal-accent)] px-3 py-2 min-h-11"
              onClick={() => void runSubmit()}
            >
              Confirm schedule
            </button>
          </div>
        </>
      ) : null}

      {step === "awaiting_consent" ? (
        <p className="text-[var(--terminal-muted)]">
          {isCrypto
            ? "Complete Terminal and crypto consent to continue…"
            : "Complete Terminal consent to continue…"}
        </p>
      ) : null}

      {step === "submitting" ? (
        <p className="text-[var(--terminal-muted)]">Creating schedule…</p>
      ) : null}

      {step === "success" && result ? (
        <>
          <p>
            Scheduled {result.side} {sizeLabel} {result.symbol}.
          </p>
          <Link
            to="/terminal/orders"
            search={{
              tab: "scheduled",
              instructionId: result.id,
              portfolioId,
              status: "all",
              side: "all",
            }}
            className="flex min-h-11 items-center justify-center rounded-md border border-[var(--terminal-border)] px-3 py-2"
            onClick={() => handleClose(false)}
          >
            View scheduled trade
          </Link>
          <button
            type="button"
            className="w-full rounded-md bg-[var(--terminal-accent)] px-3 py-2 min-h-11"
            onClick={() => handleClose(false)}
          >
            Done
          </button>
        </>
      ) : null}

      {step === "error" ? (
        <>
          <p className="text-[var(--terminal-red)]">{error ?? "Something went wrong."}</p>
          <button
            type="button"
            className="w-full rounded-md border border-[var(--terminal-border)] px-3 py-2 min-h-11"
            onClick={() => setStep("details")}
          >
            Try again
          </button>
        </>
      ) : null}
    </div>
  );

  if (isNarrow) {
    return (
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="bottom"
          className={cn(
            "gap-0 rounded-t-xl border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-0 text-[var(--terminal-text)]",
            "max-h-[min(90dvh,calc(100dvh-1rem))] overflow-hidden",
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDialogCloseButton(event.currentTarget);
          }}
        >
          <SheetHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left">
            <SheetTitle>Schedule trade</SheetTitle>
            <SheetDescription className="text-[var(--terminal-muted)]">
              {side.toUpperCase()} {symbol} · {portfolioName} · Market only
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {body}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule trade</DialogTitle>
          <DialogDescription className="text-[var(--terminal-muted)]">
            {side.toUpperCase()} {symbol} · {portfolioName} · Market orders only
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
