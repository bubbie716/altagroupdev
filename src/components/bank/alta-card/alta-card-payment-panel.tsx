"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  fetchCardPaymentContext,
  submitCardPaymentRecord,
} from "@/lib/bank/alta-card.functions";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import { AltaCardActionButton } from "@/components/bank/alta-card/alta-card-ui-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function AltaCardPaymentPanel({
  card,
  variant = "button",
}: {
  card: AltaCardRow;
  variant?: "button" | "quick" | "panel";
}) {
  const router = useRouter();
  const loadContext = useServerFn(fetchCardPaymentContext);
  const submit = useServerFn(submitCardPaymentRecord);
  const isModal = variant === "quick" || variant === "button";

  const [open, setOpen] = useState(variant === "panel");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentKind, setPaymentKind] = useState<"minimum" | "statement" | "current" | "custom">(
    "current",
  );
  const [accounts, setAccounts] = useState<
    { id: string; accountName: string; accountNumber: string; availableBalance: number }[]
  >([]);
  const [balances, setBalances] = useState({
    minimum: 0,
    statement: 0,
    current: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resultRef, setResultRef] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const disabled = card.currentBalance <= 0 || card.status === "closed";

  function applyPaymentKind(
    kind: typeof paymentKind,
    ctx: { minimumPayment: number; statementBalance: number; currentBalance: number },
  ) {
    setPaymentKind(kind);
    if (kind === "minimum") setAmount(String(ctx.minimumPayment));
    else if (kind === "statement") setAmount(String(ctx.statementBalance));
    else if (kind === "current") setAmount(String(ctx.currentBalance));
  }

  async function openPanel() {
    setOpen(true);
    setStep("form");
    setError(null);
    setLoading(true);
    try {
      const ctx = await loadContext({ data: card.id });
      setAccounts(ctx.sourceAccounts);
      setSourceAccountId(ctx.sourceAccounts[0]?.id ?? "");
      setBalances({
        minimum: ctx.minimumPayment,
        statement: ctx.statementBalance,
        current: ctx.currentBalance,
      });
      applyPaymentKind("current", ctx);
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Could not load payment options");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStep("form");
      setError(null);
      setResultRef(null);
    }
  }

  useEffect(() => {
    if (variant === "panel" && !loadedRef.current) {
      loadedRef.current = true;
      void openPanel();
    }
  }, [variant]);

  async function handleConfirm() {
    setError(null);
    setPending(true);
    try {
      const res = (await submit({
        data: {
          cardId: card.id,
          sourceAccountId,
          amount: Number(amount),
          paymentKind,
          memo: undefined,
        },
      })) as { referenceCode: string };
      setResultRef(res.referenceCode);
      setStep("done");
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err, "card_payment"));
    } finally {
      setPending(false);
    }
  }

  const payAmount = Number(amount) || 0;
  const resultingBalance = Math.max(0, card.currentBalance - payAmount);

  const paymentDescription =
    card.cardType === "business"
      ? "Pay from a business operating account toward the company card balance."
      : "Pay from your Alta Bank account toward your card balance.";

  function renderContent() {
    if (loading) {
      return <p className="text-[13px] text-muted-foreground">Loading payment options…</p>;
    }

    if (step === "done") {
      return (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Payment posted</p>
          <p className="mt-2 text-[14px]">Reference {resultRef}</p>
          {isModal ? (
            <button
              type="button"
              className="mt-4 rounded border border-border px-3 py-1 text-[12px]"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </button>
          ) : null}
        </div>
      );
    }

    return (
      <>
        {!isModal ? (
          <>
            <p className="font-serif text-[18px]">Make a payment</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{paymentDescription}</p>
          </>
        ) : null}

        {step === "form" ? (
          <form
            className={cn(isModal ? "space-y-4" : "mt-4 space-y-4")}
            onSubmit={(e) => {
              e.preventDefault();
              if (!sourceAccountId) {
                setError("Select a source account");
                return;
              }
              if (!payAmount || payAmount <= 0) {
                setError("Enter a valid amount");
                return;
              }
              setStep("confirm");
            }}
          >
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {(
                [
                  ["minimum", "Minimum"],
                  ["statement", "Statement"],
                  ["current", "Full balance"],
                  ["custom", "Custom"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    if (kind === "custom") {
                      setPaymentKind("custom");
                      return;
                    }
                    applyPaymentKind(kind, {
                      minimumPayment: balances.minimum,
                      statementBalance: balances.statement,
                      currentBalance: balances.current,
                    });
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-[11px] font-medium",
                    paymentKind === kind ? "border-gold/50 bg-gold/5" : "border-border",
                  )}
                >
                  {label}
                  {kind !== "custom" ? (
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                      {kind === "minimum" && formatAltaCardCurrency(balances.minimum)}
                      {kind === "statement" && formatAltaCardCurrency(balances.statement)}
                      {kind === "current" && formatAltaCardCurrency(balances.current)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Source account
              </span>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} · {a.accountNumber} · {florin(a.availableBalance)} avail.
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Payment amount
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setPaymentKind("custom");
                  setAmount(e.target.value);
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px]"
              />
            </label>

            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              {isModal ? (
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded border border-border px-3 py-2 text-[12px]"
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
              >
                Review payment
              </button>
            </div>
          </form>
        ) : (
          <div className={cn(isModal ? "space-y-4" : "mt-4 space-y-4")}>
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-[14px]">
              <p>
                Confirm payment of <strong>{florin(payAmount)}</strong> toward your Alta Card.
              </p>
              <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Current balance</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(card.currentBalance)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Balance after payment</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(resultingBalance)}</dd>
                </div>
              </dl>
            </div>
            {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="rounded border border-border px-3 py-2 text-[12px]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleConfirm()}
                className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
              >
                {pending ? "Processing…" : "Confirm payment"}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (isModal) {
    return (
      <>
        {variant === "quick" ? (
          <AltaCardActionButton
            label="Make payment"
            variant="primary"
            tile
            disabled={disabled}
            onClick={() => void openPanel()}
          />
        ) : (
          <button
            type="button"
            onClick={() => void openPanel()}
            disabled={disabled}
            className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
          >
            Make payment
          </button>
        )}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-lg border-border bg-background">
            <DialogHeader>
              <DialogTitle className="font-serif text-[20px]">Make a payment</DialogTitle>
              <DialogDescription>{paymentDescription}</DialogDescription>
            </DialogHeader>
            {renderContent()}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <div className={cn(variant === "panel" ? "" : "rounded-xl border border-border bg-surface-1/80 p-5")}>
      {renderContent()}
    </div>
  );
}
