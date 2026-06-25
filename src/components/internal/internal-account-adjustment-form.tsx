import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { adminAdjustBankAccountRecord } from "@/lib/bank/bank.functions";
import { florin } from "@/lib/bank/api";

export function InternalAccountAdjustmentForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [allowOverdraft, setAllowOverdraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!reason.trim()) {
      setError("Reason is required.");
      return;
    }
    if (
      direction === "debit" &&
      allowOverdraft &&
      !window.confirm("Admin override: allow debit below zero balance?")
    ) {
      return;
    }
    if (!window.confirm(`${direction === "credit" ? "Credit" : "Debit"} ${florin(parsed)}?`)) return;

    setSubmitting(true);
    try {
      const result = await adminAdjustBankAccountRecord({
        data: {
          accountId,
          direction,
          amount: parsed,
          reason: reason.trim(),
          allowOverdraft: direction === "debit" ? allowOverdraft : undefined,
        },
      });
      setSuccess(`Adjustment recorded (${result.referenceCode}).`);
      setAmount("");
      setReason("");
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Adjustment failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border/60 bg-surface-2/30 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Direction
          </span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "credit" | "debit")}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="credit">Credit (add funds)</option>
            <option value="debit">Debit (remove funds)</option>
          </select>
        </label>
        <label className="block text-[13px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Amount (FLR)
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm tabular"
            required
          />
        </label>
      </div>
      <label className="block text-[13px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Reason (required)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          required
        />
      </label>
      {direction === "debit" && (
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <input
            type="checkbox"
            checked={allowOverdraft}
            onChange={(e) => setAllowOverdraft(e.target.checked)}
          />
          Admin override — allow debit below zero
        </label>
      )}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
      {success && <p className="text-[12px] text-emerald-600">{success}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
      >
        {submitting ? "Processing…" : "Submit adjustment"}
      </button>
    </form>
  );
}
