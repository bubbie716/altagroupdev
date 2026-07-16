"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { transferBlockedReason } from "@/lib/bank/account-status-copy";
import {
  fetchTerminalFundingRequest,
  submitTerminalFundingTransfer,
} from "@/lib/bank/ncc-terminal-funding.functions";
import { resolveFundingIdempotencyKey } from "@/lib/bank/ncc-terminal-funding-idempotency";
import type { CustomerTerminalFundingView } from "@/server/ncc/ncc-funding.service";
import {
  BankRequestActionButton,
  BankRequestErrorCard,
  BankRequestSubmitButton,
} from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "form" | "review" | "success" | "processing" | "error";

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
  defaultFromAccountId,
  onSuccess,
}: {
  accounts: UserBankAccount[];
  terminalAvailableBalance: string;
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
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerTerminalFundingView | null>(null);
  const [terminalBalance, setTerminalBalance] = useState(terminalAvailableBalance);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);

  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const availableBalance = fromAccount?.availableBalance ?? fromAccount?.balance ?? 0;
  const heldFunds = fromAccount?.accountStatusInfo.heldFunds ?? 0;

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  function resetForm() {
    setView("form");
    setErrorReason(null);
    setResult(null);
    setAmount("");
    setMemo("");
    idempotencyKeyRef.current = null;
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
    setResult(next);
    if (next.terminalAvailableBalance) setTerminalBalance(next.terminalAvailableBalance);
    if (next.status === "COMPLETED") {
      setView("success");
      idempotencyKeyRef.current = null;
      onSuccess?.();
      return;
    }
    if (next.status === "FAILED" || next.status === "CANCELLED") {
      showError(next.failureMessage ?? "We couldn’t complete this transfer.");
      return;
    }
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
        // Keep processing state; user can refresh history.
      }
    }, 2_000);
  }

  function goToReview(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const blocked = fromAccount
      ? transferBlockedReason(fromAccount.accountStatusInfo, "source")
      : null;
    if (blocked) {
      showError(blocked);
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      showError("Enter a valid amount with up to two decimal places.");
      return;
    }
    const transferAmount = Number(amount);
    if (!(transferAmount > 0)) {
      showError("Enter an amount greater than zero.");
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
    setView("review");
  }

  async function onConfirm() {
    if (submitting) return;
    setSubmitting(true);
    idempotencyKeyRef.current = resolveFundingIdempotencyKey(idempotencyKeyRef.current);

    try {
      const next = await submitTerminalFundingTransfer({
        data: {
          sourceBankAccountId: fromAccountId,
          amount: amount.trim(),
          currency: "FLR",
          idempotencyKey: idempotencyKeyRef.current,
          memo: memo.trim() || undefined,
        },
      });
      applyResult(next);
    } catch (err) {
      const raw =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to complete transfer.";
      showError(raw);
    } finally {
      setSubmitting(false);
    }
  }

  const canContinue =
    !!fromAccountId &&
    !!amount &&
    Number(amount) > 0 &&
    Number(amount) <= availableBalance &&
    !submitting;

  if (accounts.length === 0) {
    return (
      <Card className="!p-6 text-[14px] text-muted-foreground">
        Open a personal Alta Bank account before transferring funds to Alta Terminal.
      </Card>
    );
  }

  if (view === "error") {
    return <BankRequestErrorCard reason={errorReason} onTryAgain={resetForm} />;
  }

  if ((view === "success" || view === "processing") && result) {
    return (
      <Card className="space-y-5 !p-6">
        <div>
          <p className="type-meta text-gold">
            {result.status === "COMPLETED" ? "Transfer completed" : result.statusLabel}
          </p>
          <h2 className="mt-2 font-serif text-[24px] tracking-tight">
            {florin(Number(result.amount))} to Alta Terminal
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {result.status === "COMPLETED"
              ? "Settlement completed immediately through NCC. This transfer is final."
              : "Your transfer was submitted to NCC and is still processing. Refresh this page or check history for updates — do not resubmit."}
          </p>
        </div>

        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">From</dt>
            <dd className="mt-1 font-medium">
              {result.sourceAccountLabel} · {result.sourceAccountNumber}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">To</dt>
            <dd className="mt-1 font-medium">{result.destinationLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1 font-medium">{result.statusLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">NCC reference</dt>
            <dd className="mt-1 font-mono text-[12px]">{result.publicReference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="mt-1">{formatWhen(result.completedAt)}</dd>
          </div>
          {result.bankAvailableBalance ? (
            <div>
              <dt className="text-muted-foreground">Updated Bank available</dt>
              <dd className="mt-1 font-medium">{florin(Number(result.bankAvailableBalance))}</dd>
            </div>
          ) : null}
          {result.terminalAvailableBalance ? (
            <div>
              <dt className="text-muted-foreground">Updated Terminal cash</dt>
              <dd className="mt-1 font-medium">{florin(Number(result.terminalAvailableBalance))}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="rounded-md border border-border bg-background px-4 py-2 text-[13px] font-medium hover:bg-surface-2"
          >
            Make another transfer
          </button>
          <Link
            to="/bank/accounts/$accountId"
            params={{ accountId: result.sourceBankAccountId }}
            className="rounded-md border border-border bg-background px-4 py-2 text-[13px] font-medium hover:bg-surface-2"
          >
            View source account activity
          </Link>
        </div>
      </Card>
    );
  }

  if (view === "review") {
    return (
      <Card className="space-y-6 !p-6">
        <div>
          <p className="type-meta text-gold">Review transfer</p>
          <h2 className="mt-2 font-serif text-[22px] tracking-tight">Confirm instant settlement</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Once completed, this transfer is immediate and final. NCC settles individually — there is
            no batching or delayed clearing window.
          </p>
        </div>
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">From</dt>
            <dd className="mt-1 font-medium">
              {fromAccount?.accountName} · {fromAccount?.accountNumber}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">To</dt>
            <dd className="mt-1 font-medium">My Alta Terminal account</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="mt-1 font-medium">{florin(Number(amount))}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Currency</dt>
            <dd className="mt-1 font-medium">FLR</dd>
          </div>
          {memo.trim() ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Memo</dt>
              <dd className="mt-1">{memo.trim()}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => setView("form")}
            className="rounded-md border border-border bg-background px-4 py-2 text-[13px] font-medium hover:bg-surface-2 disabled:opacity-60"
          >
            Back
          </button>
          <BankRequestActionButton
            onClick={() => void onConfirm()}
            submitting={submitting}
            disabled={submitting}
            submittingLabel="Sending…"
          >
            Confirm and send
          </BankRequestActionButton>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={goToReview} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Transfer FLR from your personal Alta Bank account to your own Alta Terminal trading-cash
          account. Settlement is immediate through NCC.
        </p>

        <div>
          <label className={fieldLabel}>From account</label>
          <Select value={fromAccountId} onValueChange={setFromAccountId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.accountName} · {account.accountNumber} · {florin(account.availableBalance)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Available Bank balance:{" "}
            <span className="font-medium text-foreground">{florin(availableBalance)}</span>
            {heldFunds > 0 ? ` (${florin(heldFunds)} held)` : null}
          </p>
        </div>

        <div>
          <label className={fieldLabel}>Destination</label>
          <input
            readOnly
            value="My Alta Terminal account"
            className={`${inputClass} bg-surface-2/50 text-muted-foreground`}
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            Terminal cash balance:{" "}
            <span className="font-medium text-foreground">{florin(Number(terminalBalance))}</span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={fieldLabel} htmlFor="terminal-funding-amount">
              Amount
            </label>
            <input
              id="terminal-funding-amount"
              ref={amountInputRef}
              className={inputClass}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={fieldLabel}>Currency</label>
            <input readOnly value="FLR" className={`${inputClass} bg-surface-2/50 text-muted-foreground`} />
          </div>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="terminal-funding-memo">
            Memo <span className="text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="terminal-funding-memo"
            className="mt-2"
            rows={3}
            maxLength={256}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Optional note for your records"
          />
        </div>

        <div className="rounded-md border border-border bg-surface-2/40 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
          Settlement is immediate and final once completed. Sending to another NCC institution or an
          external beneficiary is coming soon.
        </div>

        <BankRequestSubmitButton
          kind="transfer"
          submitting={false}
          disabled={!canContinue}
          label="Continue to review"
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
