"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { florin } from "@/lib/bank/api";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import {
  formatBankActionError,
  transferBlockedReason,
} from "@/lib/bank/account-status-copy";
import {
  fetchTerminalFundingRequest,
  submitTerminalFundingTransfer,
} from "@/lib/bank/ncc-terminal-funding.functions";
import { resolveFundingIdempotencyKey } from "@/lib/bank/ncc-terminal-funding-idempotency";
import type { CustomerTerminalFundingView } from "@/server/ncc/ncc-funding.service";
import {
  BankRequestErrorCard,
  BankRequestPendingCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "form" | "success" | "processing" | "error";

function accountLabel(account: UserBankAccount) {
  return `${account.accountName} · ${account.accountNumber} · ${florin(account.availableBalance)} · Personal`;
}

function resolveInitialFromAccountId(accounts: UserBankAccount[], preferredAccountId?: string) {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) {
    return preferredAccountId;
  }
  return accounts[0]?.id ?? "";
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function BankTerminalFundingForm({
  accounts,
  terminalAvailableBalance,
  terminalAccountNumberMasked,
  defaultFromAccountId,
  onSuccess,
}: {
  accounts: UserBankAccount[];
  terminalAvailableBalance: string;
  terminalAccountNumberMasked?: string;
  defaultFromAccountId?: string;
  onSuccess?: () => void;
}) {
  const [fromAccountId, setFromAccountId] = useState(() =>
    resolveInitialFromAccountId(accounts, defaultFromAccountId),
  );
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [view, setView] = useState<FormView>("form");
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const availableBalance = fromAccount?.availableBalance ?? fromAccount?.balance ?? 0;
  const heldFunds = fromAccount?.accountStatusInfo.heldFunds ?? 0;

  const amountInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  function resetForm(options?: { clearIdempotencyKey?: boolean }) {
    setView("form");
    setErrorReason(null);
    setSubmission(null);
    setPendingRequestId(null);
    setAmount("");
    setMemo("");
    // Only clear after a confirmed final success. Retries after ambiguous/failed
    // responses must reuse the same key so money cannot move twice.
    if (options?.clearIdempotencyKey) {
      idempotencyKeyRef.current = null;
    }
    pollCountRef.current = 0;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setFromAccountId(resolveInitialFromAccountId(accounts, defaultFromAccountId));
    queueMicrotask(() => amountInputRef.current?.focus());
  }

  function showError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function applyResult(next: CustomerTerminalFundingView) {
    if (next.status === "COMPLETED") {
      idempotencyKeyRef.current = null;
      setSubmission({
        referenceCode: next.publicReference ?? next.requestId,
        amount: Number(next.amount),
        submittedAt: next.completedAt ?? next.createdAt,
        accountName: next.sourceAccountLabel,
        accountNumber: next.sourceAccountNumber,
      });
      setView("success");
      onSuccess?.();
      return;
    }
    if (next.status === "FAILED" || next.status === "CANCELLED") {
      showError(next.failureMessage ?? "We couldn’t complete this transfer.");
      return;
    }
    setPendingRequestId(next.requestId);
    setView("processing");
    schedulePoll(next.requestId);
  }

  function schedulePoll(requestId: string) {
    if (pollCountRef.current >= 8) return;
    pollCountRef.current += 1;
    pollTimerRef.current = setTimeout(async () => {
      try {
        const next = await fetchTerminalFundingRequest({ data: requestId });
        applyResult(next);
      } catch {
        // Keep processing state; the user can check status manually.
      }
    }, 2_000);
  }

  async function checkPendingStatus() {
    if (!pendingRequestId || checkingStatus) return;
    setCheckingStatus(true);
    try {
      const next = await fetchTerminalFundingRequest({ data: pendingRequestId });
      applyResult(next);
    } catch {
      // Leave processing view untouched on transient errors.
    } finally {
      setCheckingStatus(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const transferAmount = Number(amount);
    const blocked = fromAccount
      ? transferBlockedReason(fromAccount.accountStatusInfo, "source")
      : null;
    if (blocked) {
      showError(blocked);
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !(transferAmount > 0)) {
      showError("Enter a valid amount greater than zero with up to two decimal places.");
      return;
    }
    if (transferAmount > availableBalance) {
      showError(
        heldFunds > 0
          ? "This transfer couldn't be completed because your available balance is reduced by held funds."
          : "This transfer couldn't be completed because your available balance is insufficient.",
      );
      return;
    }

    setSubmitting(true);
    idempotencyKeyRef.current = resolveFundingIdempotencyKey(idempotencyKeyRef.current);

    try {
      const result = await submitTerminalFundingTransfer({
        data: {
          sourceBankAccountId: fromAccountId,
          amount: amount.trim(),
          currency: "FLR",
          idempotencyKey: idempotencyKeyRef.current,
          memo: memo.trim() || undefined,
        },
      });
      applyResult(result);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to complete transfer.";
      const formatted = formatBankActionError(raw, {
        action: "transfer",
        accountId: fromAccountId,
      });
      showError(formatted.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !!fromAccountId &&
    !!amount &&
    Number(amount) > 0 &&
    Number(amount) <= availableBalance;

  if (accounts.length === 0) {
    return (
      <Card className="!p-6 text-[14px] text-muted-foreground">
        Open a personal Alta Bank account before transferring funds to Alta Terminal.
      </Card>
    );
  }

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="transfer"
        result={submission}
        onSubmitAnother={() => resetForm({ clearIdempotencyKey: true })}
      />
    );
  }

  if (view === "processing") {
    return (
      <BankRequestPendingCard
        title="Transfer Processing"
        body="Your transfer was sent to NCC and is still processing. Do not resubmit — no additional funds will move."
        hint={
          <>
            You can follow this transfer below under{" "}
            <strong className="font-medium text-foreground">
              Recent Bank → Terminal transfers
            </strong>
            , including its NCC reference.
          </>
        }
        actionLabel={checkingStatus ? "Checking status…" : "Check Status"}
        onAction={() => void checkPendingStatus()}
        actionBusy={checkingStatus}
      />
    );
  }

  if (view === "error") {
    return (
      <BankRequestErrorCard
        reason={errorReason}
        onTryAgain={() => resetForm({ clearIdempotencyKey: false })}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Transfer FLR from your personal Alta Bank account to your own Alta Terminal trading-cash
          account. Settlement is immediate and final through NCC.
        </p>

        <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <label className="block">
            <span className={fieldLabel}>From account</span>
            <Select value={fromAccountId} onValueChange={setFromAccountId} disabled={submitting}>
              <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="mt-2 block text-[12px] text-muted-foreground">
              Available balance:{" "}
              <span className="font-medium text-foreground">{florin(availableBalance)}</span>
              {heldFunds > 0 ? ` (${florin(heldFunds)} held)` : null}
            </span>
          </label>

          <label className="block">
            <span className={fieldLabel}>To account</span>
            <input
              readOnly
              value={
                terminalAccountNumberMasked
                  ? `My Alta Terminal · ${terminalAccountNumberMasked}`
                  : "My Alta Terminal account"
              }
              className={`${inputClass} bg-surface-2/50 text-muted-foreground`}
            />
            <span className="mt-2 block text-[12px] text-muted-foreground">
              Terminal cash balance:{" "}
              <span className="font-medium text-foreground">
                {florin(Number(terminalAvailableBalance))}
              </span>
            </span>
          </label>

          <label className="block">
            <span className={fieldLabel}>Amount (ƒ)</span>
            <input
              ref={amountInputRef}
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
            <span className={fieldLabel}>Memo</span>
            <Textarea
              autoResize
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional transfer note…"
              maxLength={256}
              className={`${inputClass} min-h-[80px]`}
            />
          </label>
        </fieldset>

        <BankRequestSubmitButton
          kind="transfer"
          submitting={submitting}
          disabled={!canSubmit}
        />
      </Card>
    </form>
  );
}

export function TerminalFundingHistory({ rows }: { rows: CustomerTerminalFundingView[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No Bank → Terminal transfers yet. Completed transfers will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-border bg-surface-2/50 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">From</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">NCC reference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.requestId} className="border-b border-border/70 last:border-0">
              <td className="px-4 py-3 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
              <td className="px-4 py-3">
                {row.sourceAccountLabel}
                <span className="block text-[11px] text-muted-foreground">{row.sourceAccountNumber}</span>
              </td>
              <td className="px-4 py-3 font-medium">{florin(Number(row.amount))}</td>
              <td className="px-4 py-3">{row.statusLabel}</td>
              <td className="px-4 py-3 font-mono text-[11px]">{row.publicReference ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
