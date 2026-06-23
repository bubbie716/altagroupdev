import { useState } from "react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitBankWithdrawalRequest } from "@/lib/bank/bank.functions";
import type { SubmitWithdrawalInput, UserBankAccount } from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

function resolveInitialAccountId(accounts: UserBankAccount[], preferredAccountId?: string) {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) {
    return preferredAccountId;
  }
  return accounts[0]?.id ?? "";
}

export function BankWithdrawForm({
  accounts,
  defaultAccountId,
}: {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
}) {
  const [bankAccountId, setBankAccountId] = useState(() =>
    resolveInitialAccountId(accounts, defaultAccountId),
  );
  const selectedAccount = accounts.find((account) => account.id === bankAccountId);
  const availableBalance = selectedAccount?.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [destinationInstructions, setDestinationInstructions] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const withdrawalAmount = Number(amount);
    if (withdrawalAmount > availableBalance) {
      setError("Insufficient balance for this withdrawal.");
      setSubmitting(false);
      return;
    }

    try {
      const input: SubmitWithdrawalInput = {
        bankAccountId,
        amount: withdrawalAmount,
        destinationInstructions,
        memo,
      };
      const result = await submitBankWithdrawalRequest({ data: input });
      setSuccess(`Withdrawal pending manual review. Reference: ${result.referenceCode}`);
      setAmount("");
      setDestinationInstructions("");
      setMemo("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to submit withdrawal.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Card className="!p-6 text-[14px] text-muted-foreground">
        Open an active Alta Bank account before submitting a withdrawal request.
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Request a Florin withdrawal. Funds are not deducted until an operator approves the request.
        </p>

        <label className="block">
          <span className={fieldLabel}>Bank account</span>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.accountName} · {a.accountNumber} · {florin(a.balance)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="block">
          <span className={fieldLabel}>Amount (ƒ)</span>
          <input
            type="number"
            min="0.01"
            max={availableBalance > 0 ? availableBalance : undefined}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputClass} tabular`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Withdrawal destination / instructions</span>
          <Textarea
            autoResize
            required
            value={destinationInstructions}
            onChange={(e) => setDestinationInstructions(e.target.value)}
            placeholder="In-game username, destination account, or payout instructions…"
            className={`${inputClass} min-h-[100px]`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Memo</span>
          <Textarea
            autoResize
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Optional notes for the reviewer…"
            className={`${inputClass} min-h-[80px]`}
          />
        </label>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/5 px-4 py-3 text-[13px] text-[var(--success)]">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            !amount ||
            Number(amount) <= 0 ||
            Number(amount) > availableBalance
          }
          className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit withdrawal request"}
        </button>
      </Card>
    </form>
  );
}
