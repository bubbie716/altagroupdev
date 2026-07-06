"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { LoadingMessage } from "@/components/ui/loading-indicator";
import { LOADING_COPY } from "@/lib/ui/route-loading";
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

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "compose" | "review" | "success" | "error";
type PaymentKind = "minimum" | "statement" | "current" | "custom";

const PAYMENT_KIND_LABELS: Record<Exclude<PaymentKind, "custom">, string> = {
  minimum: "Minimum payment",
  statement: "Statement balance",
  current: "Full balance",
};

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
  const [view, setView] = useState<FormView>("compose");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentKind, setPaymentKind] = useState<PaymentKind>("current");
  const [accounts, setAccounts] = useState<
    { id: string; accountName: string; accountNumber: string; availableBalance: number }[]
  >([]);
  const [balances, setBalances] = useState({
    minimumPayment: 0,
    statementBalance: 0,
    currentBalance: 0,
  });
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);
  const loadedRef = useRef(false);

  const disabled = card.currentBalance <= 0 || card.status === "closed";

  const paymentDescription =
    card.cardType === "business"
      ? "Pay from a business operating account toward the company card balance."
      : "Pay from your Alta Bank account toward your card balance.";

  const cardTargetLabel = `Alta Card •••• ${card.cardLastFour}`;
  const payAmount = Number(amount) || 0;
  const resultingBalance = Math.max(0, card.currentBalance - payAmount);
  const selectedAccount = accounts.find((account) => account.id === sourceAccountId);

  function applyPaymentKind(
    kind: PaymentKind,
    ctx: { minimumPayment: number; statementBalance: number; currentBalance: number },
  ) {
    setPaymentKind(kind);
    if (kind === "minimum") setAmount(String(ctx.minimumPayment));
    else if (kind === "statement") setAmount(String(ctx.statementBalance));
    else if (kind === "current") setAmount(String(ctx.currentBalance));
  }

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setPaymentKind("current");
    applyPaymentKind("current", balances);
  }

  async function openPanel() {
    setOpen(true);
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setLoading(true);
    try {
      const ctx = await loadContext({ data: card.id });
      setAccounts(ctx.sourceAccounts);
      setSourceAccountId(ctx.sourceAccounts[0]?.id ?? "");
      const nextBalances = {
        minimumPayment: ctx.minimumPayment,
        statementBalance: ctx.statementBalance,
        currentBalance: ctx.currentBalance,
      };
      setBalances(nextBalances);
      applyPaymentKind("current", nextBalances);
    } catch (err) {
      setComposeError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : "Could not load payment options",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      resetForm();
    }
  }

  useEffect(() => {
    if (variant === "panel" && !loadedRef.current) {
      loadedRef.current = true;
      void openPanel();
    }
  }, [variant]);

  function goToReview() {
    setComposeError(null);
    if (!sourceAccountId) {
      setComposeError("Select a source account.");
      return;
    }
    if (!payAmount || payAmount <= 0) {
      setComposeError("Enter a valid payment amount.");
      return;
    }
    const availableBalance = selectedAccount?.availableBalance ?? 0;
    if (payAmount > availableBalance) {
      setComposeError("Payment amount exceeds available account balance.");
      return;
    }
    setView("review");
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceAccountId || submitting) return;

    setSubmitting(true);

    try {
      const res = (await submit({
        data: {
          cardId: card.id,
          sourceAccountId,
          amount: payAmount,
          paymentKind,
          memo: undefined,
        },
      })) as { referenceCode: string };

      const submitted: BankRequestSubmissionResult = {
        referenceCode: res.referenceCode,
        amount: payAmount,
        submittedAt: new Date().toISOString(),
        accountName: selectedAccount?.accountName ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? "—",
      };

      setSubmission(submitted);
      setView("success");
      await router.invalidate();
    } catch (err) {
      setErrorReason(formatCustomerActionError(err, "card_payment"));
      setView("error");
    } finally {
      setSubmitting(false);
    }
  }

  function renderContent() {
    if (loading) {
      return <LoadingMessage>{LOADING_COPY.paymentOptions}</LoadingMessage>;
    }

    if (view === "success" && submission) {
      return (
        <BankRequestSuccessCard
          kind="card_payment"
          result={submission}
          onSubmitAnother={resetForm}
        />
      );
    }

    if (view === "error") {
      return (
        <BankRequestErrorCard
          reason={errorReason}
          onTryAgain={() => {
            setErrorReason(null);
            setView("review");
          }}
        />
      );
    }

    if (view === "review" && selectedAccount) {
      return (
        <form
          onSubmit={submitPayment}
          className={cn(!isModal && "mx-auto max-w-2xl space-y-6")}
        >
          <Card className="space-y-6 !p-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Review payment
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Confirm the details below before submitting. Your payment settles instantly and
                reduces your Alta Card balance.
              </p>
            </div>

            <div className="space-y-4 border-y border-border/60 py-6 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">From</span>
                <span className="text-right">
                  <span className="font-medium">{selectedAccount.accountName}</span>
                  <span className="mt-0.5 block font-mono text-[12px] text-muted-foreground">
                    {selectedAccount.accountNumber}
                  </span>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">To</span>
                <span className="text-right font-mono text-[12px]">{cardTargetLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Amount</span>
                <span className="type-finance-nums">{florin(payAmount)}</span>
              </div>
              {paymentKind !== "custom" ? (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Payment type</span>
                  <span className="text-right text-[13px]">{PAYMENT_KIND_LABELS[paymentKind]}</span>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Current balance</span>
                <span className="type-finance-nums">{formatAltaCardCurrency(card.currentBalance)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Balance after payment</span>
                <span className="type-finance-nums">{formatAltaCardCurrency(resultingBalance)}</span>
              </div>
            </div>

            <fieldset
              disabled={submitting}
              className="flex flex-wrap items-center gap-2 border-0 p-0 m-0 min-w-0"
            >
              <button
                type="button"
                disabled={submitting}
                onClick={() => setView("compose")}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Back
              </button>
              <BankRequestSubmitButton
                kind="card_payment"
                submitting={submitting}
                showContainer={false}
              />
            </fieldset>
          </Card>
        </form>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToReview();
        }}
        className={cn(!isModal && "mx-auto max-w-2xl space-y-6", isModal ? "space-y-4" : "space-y-6")}
      >
        <Card
          className={cn(
            isModal
              ? "space-y-4 border-0 bg-transparent p-0 shadow-none"
              : "space-y-6 !p-6",
          )}
        >
          {!isModal ? (
            <>
              <p className="font-serif text-[18px]">Make a payment</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{paymentDescription}</p>
            </>
          ) : null}

          <fieldset
            disabled={submitting}
            className={cn("border-0 p-0 m-0 min-w-0 space-y-4", !isModal && "space-y-6")}
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
                    applyPaymentKind(kind, balances);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-[11px] font-medium",
                    paymentKind === kind ? "border-gold/50 bg-gold/5" : "border-border",
                  )}
                >
                  {label}
                  {kind !== "custom" ? (
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                      {kind === "minimum" && formatAltaCardCurrency(balances.minimumPayment)}
                      {kind === "statement" && formatAltaCardCurrency(balances.statementBalance)}
                      {kind === "current" && formatAltaCardCurrency(balances.currentBalance)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <label className="block">
              <span className={fieldLabel}>Source account</span>
              <Select
                value={sourceAccountId}
                onValueChange={setSourceAccountId}
                disabled={submitting || accounts.length === 0}
              >
                <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName} · {account.accountNumber} · {florin(account.availableBalance)}{" "}
                      avail.
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className={fieldLabel}>Payment amount (ƒ)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => {
                  setPaymentKind("custom");
                  setAmount(e.target.value);
                }}
                placeholder="0.00"
                className={`${inputClass} tabular font-mono`}
              />
              {selectedAccount ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Available {florin(selectedAccount.availableBalance)}
                </p>
              ) : null}
            </label>
          </fieldset>

          {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

          <div className={cn("flex flex-wrap items-center gap-2", isModal && "mt-6")}>
            {isModal ? (
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-surface-2/60"
              >
                Cancel
              </button>
            ) : null}
            <BankRequestSubmitButton
              kind="card_payment"
              submitting={false}
              disabled={accounts.length === 0}
              label="Review Payment"
              showContainer={false}
            />
          </div>
        </Card>
      </form>
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

  return <div>{renderContent()}</div>;
}
