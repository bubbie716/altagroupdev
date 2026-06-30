"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";
import { florin } from "@/lib/bank/api";
import { submitLoanPayment } from "@/lib/bank/lending.functions";
import type { LendingAccountOption, LoanRow } from "@/lib/bank/lending-types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "compose" | "review" | "success" | "error";

function parseServerError(err: unknown): string {
  if (err instanceof Error && err.message === "FORBIDDEN") {
    return "You do not have permission to pay this loan.";
  }
  return formatCustomerActionError(err, "loan_payment");
}

export function LoanPaymentForm({
  loan,
  sourceAccounts,
  suggestedAmount,
  onSuccess,
}: {
  loan: Pick<LoanRow, "id" | "productLabel" | "currentPayoffAmount" | "outstandingBalance">;
  sourceAccounts: LendingAccountOption[];
  suggestedAmount?: number;
  onSuccess?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const pay = useServerFn(submitLoanPayment);
  const payoff = loan.currentPayoffAmount ?? loan.outstandingBalance;
  const defaultAmount = suggestedAmount ?? payoff;

  const [view, setView] = useState<FormView>("compose");
  const [sourceBankAccountId, setSourceBankAccountId] = useState(sourceAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [memo, setMemo] = useState("");
  const [composeError, setComposeError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const payAmount = Number(amount) || 0;
  const selectedAccount = sourceAccounts.find((account) => account.id === sourceBankAccountId);
  const remainingPayoff = Math.max(0, payoff - payAmount);

  function resetForm() {
    setView("compose");
    setComposeError(null);
    setErrorReason(null);
    setSubmission(null);
    setAmount(String(defaultAmount));
    setMemo("");
    setSourceBankAccountId(sourceAccounts[0]?.id ?? "");
  }

  function goToReview() {
    setComposeError(null);
    if (!sourceBankAccountId) {
      setComposeError("Select a source account.");
      return;
    }
    if (!payAmount || payAmount <= 0) {
      setComposeError("Enter a valid payment amount.");
      return;
    }
    if (payAmount > payoff) {
      setComposeError("Payment cannot exceed the current payoff amount.");
      return;
    }
    setView("review");
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceBankAccountId || submitting) return;

    setSubmitting(true);

    try {
      const result = await pay({
        data: {
          loanId: loan.id,
          sourceBankAccountId,
          amount: payAmount,
          memo: memo.trim() || undefined,
        },
      });

      const submitted: BankRequestSubmissionResult = {
        referenceCode: result.referenceCode,
        amount: result.amount,
        submittedAt: new Date().toISOString(),
        accountName: selectedAccount?.label ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? loan.productLabel,
      };

      setSubmission(submitted);
      setView("success");
      await onSuccess?.();
      await router.invalidate();
    } catch (err) {
      setErrorReason(parseServerError(err));
      setView("error");
    } finally {
      setSubmitting(false);
    }
  }

  if (sourceAccounts.length === 0) {
    return (
      <Card>
        <p className="text-[13px] text-muted-foreground">
          Open an active Alta Bank account with sufficient balance to make a payment.
        </p>
      </Card>
    );
  }

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="loan_payment"
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
      <form onSubmit={submitPayment} className="space-y-4">
        <Card className="space-y-6 !p-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Review payment
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Confirm the details below before submitting. Your payment settles instantly and reduces
              your loan payoff amount.
            </p>
          </div>

          <div className="space-y-4 border-y border-border/60 py-6 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">From</span>
              <span className="text-right">
                <span className="font-medium">{selectedAccount.label}</span>
                <span className="mt-0.5 block font-mono text-[12px] text-muted-foreground">
                  {selectedAccount.accountNumber}
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">To</span>
              <span className="text-right">
                <span className="font-medium">{loan.productLabel}</span>
                <span className="mt-0.5 block font-mono text-[12px] text-muted-foreground">
                  {loan.id.slice(0, 10)}
                </span>
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <span className="type-finance-nums">{florin(payAmount)}</span>
            </div>
            {memo.trim() ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Memo</span>
                <span className="max-w-[220px] text-right text-[13px]">{memo.trim()}</span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Current payoff</span>
              <span className="type-finance-nums">{florin(payoff)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Payoff after payment</span>
              <span className="type-finance-nums">{florin(remainingPayoff)}</span>
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
              kind="loan_payment"
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
      className="space-y-4"
    >
      <Card className="space-y-6 !p-6">
        <div className="rounded-md border border-border/60 bg-surface-2/30 px-4 py-3 text-[13px]">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Current payoff amount</span>
            <span className="type-finance font-medium">{florin(payoff)}</span>
          </div>
        </div>

        <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <label className="block">
            <span className={fieldLabel}>Source account</span>
            <Select
              value={sourceBankAccountId}
              onValueChange={setSourceBankAccountId}
              disabled={submitting}
            >
              <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {sourceAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.label} · {account.accountNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="block">
            <span className={fieldLabel}>Payment amount (Florins)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={payoff}
              required
              className={`${inputClass} tabular`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          <label className="block">
            <span className={fieldLabel}>Memo (optional)</span>
            <Textarea
              autoResize
              className={`${inputClass} min-h-[80px]`}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional note for your records"
            />
          </label>
        </fieldset>

        {composeError ? <p className="text-sm text-destructive">{composeError}</p> : null}

        <BankRequestSubmitButton
          kind="loan_payment"
          submitting={false}
          label="Review Payment"
        />
      </Card>
    </form>
  );
}
