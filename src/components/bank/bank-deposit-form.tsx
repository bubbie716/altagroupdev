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
import { submitBankDepositRequest } from "@/lib/bank/bank.functions";
import type { SubmitDepositInput, UserBankAccount } from "@/lib/bank/backend-types";
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

export function BankDepositForm({
  accounts,
  defaultAccountId,
}: {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
}) {
  const [bankAccountId, setBankAccountId] = useState(() =>
    resolveInitialAccountId(accounts, defaultAccountId),
  );
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [proofFilename, setProofFilename] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const input: SubmitDepositInput = {
        bankAccountId,
        amount: Number(amount),
        memo,
        proofFilename,
      };
      const result = await submitBankDepositRequest({ data: input });
      setSuccess(`Deposit pending manual review. Reference: ${result.referenceCode}`);
      setAmount("");
      setMemo("");
      setProofFilename("");
    } catch (err) {
      const message = err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to submit deposit.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Card className="!p-6 text-[14px] text-muted-foreground">
        Open an active Alta Bank account before submitting a deposit request.
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Submit a Florin deposit with screenshot proof. Deposits are reviewed manually and balances update only
          after approval.
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
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={`${inputClass} tabular`}
          />
        </label>

        <label className="block">
          <span className={fieldLabel}>Screenshot proof</span>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => setProofFilename(e.target.files?.[0]?.name ?? "")}
            className="mt-2 block w-full text-[13px] text-muted-foreground file:mr-4 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-2 file:text-[12px] file:font-medium"
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            Upload UI placeholder — file is not stored yet. Filename is saved for review. TODO: Vercel Blob / S3.
          </p>
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
          disabled={submitting || !proofFilename}
          className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit deposit request"}
        </button>
      </Card>
    </form>
  );
}
