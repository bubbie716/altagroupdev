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
import { florin } from "@/lib/bank/api";
import { submitLoanPayment } from "@/lib/bank/lending.functions";
import type { LendingAccountOption, LoanRow } from "@/lib/bank/lending-types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

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
  loan: Pick<LoanRow, "id" | "currentPayoffAmount" | "outstandingBalance">;
  sourceAccounts: LendingAccountOption[];
  suggestedAmount?: number;
  onSuccess?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const pay = useServerFn(submitLoanPayment);
  const payoff = loan.currentPayoffAmount ?? loan.outstandingBalance;
  const defaultAmount = suggestedAmount ?? payoff;
  const [sourceBankAccountId, setSourceBankAccountId] = useState(sourceAccounts[0]?.id ?? "");
  const [amount, setAmount] = useState(String(defaultAmount));
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await pay({
        data: {
          loanId: loan.id,
          sourceBankAccountId,
          amount: Number(amount),
          memo: memo || undefined,
        },
      });
      await onSuccess?.();
      await router.invalidate();
    } catch (err) {
      setError(parseServerError(err));
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

  return (
    <Card>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        <div className="rounded-md border border-border/60 bg-surface-2/30 px-4 py-3 text-[13px]">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Current payoff amount</span>
            <span className="type-finance font-medium">{florin(payoff)}</span>
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Source account</label>
          <Select value={sourceBankAccountId} onValueChange={setSourceBankAccountId}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label} · {a.accountNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="paymentAmount">
            Payment amount (Florins)
          </label>
          <input
            id="paymentAmount"
            type="number"
            min="0.01"
            step="0.01"
            max={payoff}
            required
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="memo">
            Memo (optional)
          </label>
          <input
            id="memo"
            type="text"
            className={inputClass}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md border border-gold/40 bg-gold/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold disabled:opacity-50"
        >
          {submitting ? "Processing…" : "Submit payment"}
        </button>
      </form>
    </Card>
  );
}
