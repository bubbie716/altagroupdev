"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import {
  fetchCashAdvanceContext,
  fetchEmployeeCashAdvanceContext,
  submitCashAdvanceRecord,
  submitEmployeeCashAdvanceRecord,
} from "@/lib/bank/alta-card.functions";
import type { AltaCardRow, UserEmployeeAltaCardSummary } from "@/lib/bank/alta-card-types";
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

type AltaCardCashAdvancePanelProps = {
  variant?: "button" | "quick" | "panel";
} & (
  | { card: AltaCardRow; employeeCard?: never }
  | { employeeCard: UserEmployeeAltaCardSummary; card?: never }
);

export function AltaCardCashAdvancePanel({
  card,
  employeeCard,
  variant = "button",
}: AltaCardCashAdvancePanelProps) {
  const router = useRouter();
  const isEmployee = Boolean(employeeCard);
  const loadCardContext = useServerFn(fetchCashAdvanceContext);
  const loadEmployeeContext = useServerFn(fetchEmployeeCashAdvanceContext);
  const submitCardAdvance = useServerFn(submitCashAdvanceRecord);
  const submitEmployeeAdvance = useServerFn(submitEmployeeCashAdvanceRecord);
  const isModal = variant === "quick" || variant === "button";

  const [open, setOpen] = useState(variant === "panel");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [accounts, setAccounts] = useState<
    { id: string; accountName: string; accountNumber: string }[]
  >([]);
  const [availableCredit, setAvailableCredit] = useState(
    isEmployee ? employeeCard!.employeeAvailableLimit : card!.availableCredit,
  );
  const [currentBalance, setCurrentBalance] = useState(
    isEmployee ? employeeCard!.employeeCurrentBalance : card!.currentBalance,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resultRef, setResultRef] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const disabled = isEmployee
    ? employeeCard!.status !== "active" || employeeCard!.employeeAvailableLimit <= 0
    : card!.status !== "active" || card!.availableCredit <= 0;

  const advanceDescription = isEmployee
    ? "Transfer available employee credit to one of your personal Alta accounts. Cash advances increase your employee spend balance."
    : card!.cardType === "business"
      ? "Transfer available credit to a personal or business operating account. Cash advances increase the company card balance."
      : "Transfer available credit to your checking account. Cash advances increase your Alta Card balance.";

  async function openPanel() {
    setOpen(true);
    setStep("form");
    setError(null);
    setLoading(true);
    try {
      if (isEmployee) {
        const ctx = await loadEmployeeContext({ data: employeeCard!.id });
        setAccounts(ctx.destinationAccounts);
        setAvailableCredit(ctx.availableCredit);
        setCurrentBalance(ctx.currentBalance);
        setDestinationAccountId(ctx.destinationAccounts[0]?.id ?? "");
        if (ctx.destinationAccounts.length === 0) {
          setError("Open a personal Alta account to receive cash advances.");
        }
      } else {
        const ctx = await loadCardContext({ data: card!.id });
        setAccounts(ctx.destinationAccounts);
        setAvailableCredit(ctx.availableCredit);
        setCurrentBalance(ctx.card.currentBalance);
        setDestinationAccountId(ctx.destinationAccounts[0]?.id ?? "");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Could not load cash advance options",
      );
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
      setAmount("");
      setMemo("");
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
      const res = isEmployee
        ? await submitEmployeeAdvance({
            data: {
              employeeCardId: employeeCard!.id,
              destinationAccountId,
              amount: Number(amount),
              memo: memo.trim() || undefined,
            },
          })
        : await submitCardAdvance({
            data: {
              cardId: card!.id,
              destinationAccountId,
              amount: Number(amount),
              memo: memo.trim() || undefined,
            },
          });
      setResultRef(res.referenceCode);
      setStep("done");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Cash advance failed");
    } finally {
      setPending(false);
    }
  }

  const advanceAmount = Number(amount) || 0;
  const resultingBalance = currentBalance + advanceAmount;
  const resultingAvailable = Math.max(0, availableCredit - advanceAmount);
  const balanceLabel = isEmployee ? "Employee spend balance" : "Current balance";

  function renderContent() {
    if (loading) {
      return <p className="text-[13px] text-muted-foreground">Loading cash advance options…</p>;
    }

    if (step === "done") {
      return (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Cash advance posted</p>
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
          step === "form" ? (
            <>
              <p className="font-serif text-[18px]">Cash advance</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Cash advances increase your {isEmployee ? "employee spend balance" : "Alta Card balance"}.
                Available credit {formatAltaCardCurrency(availableCredit)}.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Available credit: {formatAltaCardCurrency(availableCredit)} · Cash advances increase your{" "}
              {isEmployee ? "employee spend balance" : "Alta Card balance"}.
            </p>
          )
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Available credit: {formatAltaCardCurrency(availableCredit)}
          </p>
        )}

        {step === "form" ? (
          <form
            className={cn(isModal ? "space-y-4" : "mt-4 space-y-4")}
            onSubmit={(e) => {
              e.preventDefault();
              if (!destinationAccountId) {
                setError("Select a destination account");
                return;
              }
              if (!advanceAmount || advanceAmount <= 0) {
                setError("Enter a valid amount");
                return;
              }
              if (advanceAmount > availableCredit) {
                setError("Amount exceeds available credit");
                return;
              }
              setStep("confirm");
            }}
          >
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Destination account
              </span>
              <select
                value={destinationAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
                disabled={accounts.length === 0}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.accountName} · {a.accountNumber}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Amount
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={availableCredit}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px]"
              />
            </label>
            <label className="block space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Memo (optional)
              </span>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px]"
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
                disabled={accounts.length === 0}
                className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
              >
                Review cash advance
              </button>
            </div>
          </form>
        ) : (
          <div className={cn(isModal ? "space-y-4" : "mt-4 space-y-4")}>
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-[14px]">
              <p>
                Confirm cash advance of <strong>{florin(advanceAmount)}</strong> to your selected
                account.
              </p>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Cash advances increase your {isEmployee ? "employee spend balance" : "Alta Card balance"}.
              </p>
              <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{balanceLabel}</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(currentBalance)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Balance after advance</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(resultingBalance)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Available credit after</dt>
                  <dd className="font-mono tabular-nums">{formatAltaCardCurrency(resultingAvailable)}</dd>
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
                {pending ? "Processing…" : "Confirm cash advance"}
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
            label="Cash advance"
            tile
            disabled={disabled}
            onClick={() => void openPanel()}
          />
        ) : (
          <button
            type="button"
            onClick={() => void openPanel()}
            disabled={disabled}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] disabled:opacity-50"
          >
            Cash advance
          </button>
        )}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="max-w-lg border-border bg-background">
            <DialogHeader>
              <DialogTitle className="font-serif text-[20px]">Cash advance</DialogTitle>
              <DialogDescription>{advanceDescription}</DialogDescription>
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
