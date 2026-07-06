import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setLoanAutoPayRecord } from "@/lib/bank/lending.functions";
import type { LendingAccountOption, LoanRow } from "@/lib/bank/lending-types";

const fieldLabel = "type-meta";

function parseServerError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not update auto-pay";
  if (message.startsWith("BAD_REQUEST:")) return message.slice("BAD_REQUEST:".length);
  if (message === "FORBIDDEN") return "You do not have permission to manage auto-pay for this loan.";
  return message;
}

export function LoanAutoPayForm({
  loan,
  sourceAccounts,
  onUpdated,
}: {
  loan: LoanRow;
  sourceAccounts: LendingAccountOption[];
  onUpdated?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const save = useServerFn(setLoanAutoPayRecord);
  const [enabled, setEnabled] = useState(loan.autoPay.enabled);
  const [sourceBankAccountId, setSourceBankAccountId] = useState(
    loan.autoPay.sourceBankAccountId ?? sourceAccounts[0]?.id ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      await save({
        data: {
          loanId: loan.id,
          enabled,
          sourceBankAccountId,
        },
      });
      setSaved(true);
      await onUpdated?.();
      await router.invalidate();
    } catch (err) {
      setError(parseServerError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!loan.canMakePayment) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Auto-pay is unavailable while this loan is not accepting payments.
      </p>
    );
  }

  if (sourceAccounts.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Open an active Alta Bank account to enable automatic loan payments.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <label className="flex items-center gap-3 text-[13px]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 rounded border-border"
        />
        <span>Enable automatic payments on each scheduled due date</span>
      </label>

      {enabled && (
        <div>
          <label className={fieldLabel}>Debit account</label>
          <Select value={sourceBankAccountId} onValueChange={setSourceBankAccountId}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sourceAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.label} · {account.accountNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loan.autoPay.enabled && loan.autoPay.sourceAccountLabel && (
        <p className="text-[12px] text-muted-foreground">
          Currently debiting {loan.autoPay.sourceAccountLabel}.
        </p>
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      )}

      {saved && (
        <p className="text-[13px] text-gold">Auto-pay settings saved.</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
      >
        {submitting ? SUBMITTING_COPY.saving : "Save auto-pay"}
      </button>
    </form>
  );
}
