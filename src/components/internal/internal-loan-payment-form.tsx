"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import { adminRecordLoanPaymentOps } from "@/lib/internal/ops-platform.functions";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { suggestedLoanPaymentAmount } from "@/lib/internal/directory-desk";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";

export function InternalLoanPaymentForm({
  loanId,
  loanLabel,
  borrowerLabel,
  linkedBankAccountId,
  linkedAccountNumber,
  currentPayoffAmount,
  paymentSchedule = [],
}: {
  loanId: string;
  loanLabel: string;
  borrowerLabel: string;
  linkedBankAccountId: string | null;
  linkedAccountNumber: string | null;
  currentPayoffAmount: number;
  paymentSchedule?: Array<{ status: string; remainingAmount: number }>;
}) {
  const router = useRouter();
  const payFn = useServerFn(adminRecordLoanPaymentOps);
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  const amountId = useId();
  const memoId = useId();
  const accountIdField = useId();

  const suggested = useMemo(
    () => suggestedLoanPaymentAmount(paymentSchedule),
    [paymentSchedule],
  );

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(suggested != null ? String(suggested) : "");
  const [memo, setMemo] = useState("");
  const [accountId, setAccountId] = useState(linkedBankAccountId ?? "");
  const [clientError, setClientError] = useState<string | null>(null);

  if (!linkedBankAccountId && !accountId) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No linked bank account on this loan. Link an account before recording operator payments.
      </p>
    );
  }

  function validateAmount(): number {
    const raw = amount.trim();
    if (!raw) throw new Error("Enter a payment amount.");
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Payment amount must be greater than zero.");
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      throw new Error("Use up to two decimal places.");
    }
    if (value > currentPayoffAmount + 0.0001) {
      throw new Error(`Amount cannot exceed payoff ${florin(currentPayoffAmount)}.`);
    }
    return value;
  }

  function openReview() {
    try {
      validateAmount();
      setClientError(null);
      setOpen(true);
    } catch (err) {
      setClientError(err instanceof Error ? err.message : "Invalid amount");
    }
  }

  const parsed = Number(amount);
  const remainingEstimate =
    Number.isFinite(parsed) && parsed > 0
      ? Math.max(0, currentPayoffAmount - parsed)
      : null;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Outstanding payoff {florin(currentPayoffAmount)}
        {linkedAccountNumber ? ` · Funding account ${linkedAccountNumber}` : ""}.
        {suggested != null ? ` Suggested due ${florin(suggested)}.` : " Enter an amount explicitly."}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor={amountId} className="block text-[11px] font-medium text-muted-foreground">
            Payment amount
          </label>
          <input
            id={amountId}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setClientError(null);
            }}
            aria-invalid={Boolean(clientError)}
            aria-describedby={clientError ? `${amountId}-error` : undefined}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={memoId} className="block text-[11px] font-medium text-muted-foreground">
            Memo (optional)
          </label>
          <input
            id={memoId}
            placeholder="Memo"
            className="w-full rounded-md border border-border px-3 py-2 text-sm"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>
      </div>
      {!linkedBankAccountId && (
        <div className="space-y-1">
          <label htmlFor={accountIdField} className="block text-[11px] font-medium text-muted-foreground">
            Source bank account ID
          </label>
          <input
            id={accountIdField}
            className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
        </div>
      )}
      {clientError ? (
        <p id={`${amountId}-error`} className="text-[12px] text-destructive" role="alert">
          {clientError}
        </p>
      ) : null}
      <button
        type="button"
        className="rounded border border-gold/30 px-3 py-1.5 font-mono text-[10px] uppercase text-gold disabled:opacity-50"
        onClick={openReview}
        disabled={uiLab}
        title={uiLab ? unavailableLabel("Record payment") : undefined}
      >
        {uiLab ? unavailableLabel("Review payment") : "Review payment"}
      </button>

      <OpsConfirmDialog
        open={open}
        title="Confirm loan payment"
        description={[
          `Payment amount: ${florin(Number(amount) || 0)}`,
          `Loan: ${loanLabel}`,
          `Borrower: ${borrowerLabel}`,
          linkedAccountNumber
            ? `Funding account: ${linkedAccountNumber}`
            : `Funding account ID: ${linkedBankAccountId ?? accountId}`,
          remainingEstimate != null
            ? `Remaining payoff estimate: ${florin(remainingEstimate)}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel="Confirm payment"
        onCancel={() => setOpen(false)}
        onConfirm={async (reason) => {
          if (uiLab) throw new Error(unavailableLabel("Record payment"));
          const paymentAmount = validateAmount();
          const sourceBankAccountId = linkedBankAccountId ?? accountId.trim();
          if (!sourceBankAccountId) throw new Error("BAD_REQUEST:Source account is required");
          await payFn({
            data: {
              loanId,
              sourceBankAccountId,
              amount: paymentAmount,
              memo: memo || undefined,
              reason,
            },
          });
          setOpen(false);
          await router.invalidate();
        }}
      />
    </div>
  );
}
