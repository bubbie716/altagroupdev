"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import { adminRecordLoanPaymentOps } from "@/lib/internal/ops-platform.functions";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";

export function InternalLoanPaymentForm({
  loanId,
  linkedBankAccountId,
  linkedAccountNumber,
  currentPayoffAmount,
}: {
  loanId: string;
  linkedBankAccountId: string | null;
  linkedAccountNumber: string | null;
  currentPayoffAmount: number;
}) {
  const router = useRouter();
  const payFn = useServerFn(adminRecordLoanPaymentOps);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(currentPayoffAmount));
  const [memo, setMemo] = useState("");
  const [accountId, setAccountId] = useState(linkedBankAccountId ?? "");

  if (!linkedBankAccountId && !accountId) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No linked bank account on this loan. Link an account before recording operator payments.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Record a manual payment from the borrower&apos;s linked account
        {linkedAccountNumber ? ` (${linkedAccountNumber})` : ""}.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Amount"
          className="rounded-md border border-border px-3 py-2 text-sm"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          placeholder="Memo (optional)"
          className="rounded-md border border-border px-3 py-2 text-sm sm:col-span-2"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>
      {!linkedBankAccountId && (
        <input
          placeholder="Source bank account ID"
          className="w-full rounded-md border border-border px-3 py-2 font-mono text-sm"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
      )}
      <button
        type="button"
        className="rounded border border-gold/30 px-3 py-1.5 font-mono text-[10px] uppercase text-gold"
        onClick={() => setOpen(true)}
      >
        Record payment
      </button>

      <OpsConfirmDialog
        open={open}
        title="Record loan payment"
        description={`Post ${florin(Number(amount))} toward loan payoff.`}
        confirmLabel="Record payment"
        onCancel={() => setOpen(false)}
        onConfirm={async (reason) => {
          const sourceBankAccountId = linkedBankAccountId ?? accountId.trim();
          if (!sourceBankAccountId) throw new Error("BAD_REQUEST:Source account is required");
          await payFn({
            data: {
              loanId,
              sourceBankAccountId,
              amount: Number(amount),
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
