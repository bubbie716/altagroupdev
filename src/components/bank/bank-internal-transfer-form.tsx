import { useRef, useState } from "react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitBankInternalTransfer } from "@/lib/bank/bank.functions";
import type { SubmitInternalTransferInput, UserBankAccount } from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";
import { INTRABANK_TRANSFER_FORM_INTRO } from "@/lib/bank/bank-shared-copy";
import {
  formatBankActionError,
  transferBlockedReason,
} from "@/lib/bank/account-status-copy";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type FormView = "form" | "success" | "error";

function accountLabel(account: UserBankAccount) {
  const owner = account.companyName ?? "Personal";
  return `${account.accountName} · ${account.accountNumber} · ${florin(account.balance)} · ${owner}`;
}

function resolveInitialFromAccountId(accounts: UserBankAccount[], preferredAccountId?: string) {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) {
    return preferredAccountId;
  }
  return accounts[0]?.id ?? "";
}

export function BankInternalTransferForm({
  accounts,
  defaultFromAccountId,
  onSuccess,
  onSubmissionSuccess,
}: {
  accounts: UserBankAccount[];
  defaultFromAccountId?: string;
  onSuccess?: () => void;
  onSubmissionSuccess?: (result: BankRequestSubmissionResult) => void;
}) {
  const canTransferOwn = accounts.length >= 2;

  const [fromAccountId, setFromAccountId] = useState(() =>
    resolveInitialFromAccountId(accounts, defaultFromAccountId),
  );
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");

  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const availableBalance = fromAccount?.availableBalance ?? fromAccount?.balance ?? 0;
  const heldFunds = fromAccount?.accountStatusInfo.heldFunds ?? 0;
  const destinationAccounts = accounts.filter((account) => account.id !== fromAccountId);

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [view, setView] = useState<FormView>("form");
  const [submitting, setSubmitting] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setView("form");
    setErrorReason(null);
    setSubmission(null);
    setAmount("");
    setMemo("");
    setFromAccountId(resolveInitialFromAccountId(accounts, defaultFromAccountId));
    queueMicrotask(() => amountInputRef.current?.focus());
  }

  function showError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function handleFromAccountChange(nextFromAccountId: string) {
    setFromAccountId(nextFromAccountId);
    if (nextFromAccountId === toAccountId) {
      const fallback = accounts.find((account) => account.id !== nextFromAccountId);
      setToAccountId(fallback?.id ?? "");
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
    if (transferAmount > availableBalance) {
      showError(
        heldFunds > 0
          ? "This transfer couldn't be completed because your available balance is reduced by held funds."
          : "This transfer couldn't be completed because your available balance is insufficient.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const input: SubmitInternalTransferInput = {
        fromAccountId,
        toAccountId,
        amount: transferAmount,
        memo,
      };

      const result = await submitBankInternalTransfer({ data: input });

      const submitted: BankRequestSubmissionResult = {
        referenceCode: result.referenceCode,
        amount: transferAmount,
        submittedAt: new Date().toISOString(),
        accountName: fromAccount?.accountName ?? "—",
        accountNumber: fromAccount?.accountNumber ?? "—",
      };

      setSubmission(submitted);
      setView("success");
      onSubmissionSuccess?.(submitted);
      onSuccess?.();
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
    canTransferOwn &&
    !!fromAccountId &&
    !!toAccountId &&
    fromAccountId !== toAccountId &&
    !!amount &&
    Number(amount) > 0 &&
    Number(amount) <= availableBalance;

  if (accounts.length === 0) {
    return (
      <Card className="!p-6 text-[14px] text-muted-foreground">
        Open an active Alta Bank account before transferring funds.
      </Card>
    );
  }

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="transfer"
        result={submission}
        onSubmitAnother={resetForm}
      />
    );
  }

  if (view === "error") {
    return <BankRequestErrorCard reason={errorReason} onTryAgain={resetForm} />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 !p-6">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {INTRABANK_TRANSFER_FORM_INTRO}
        </p>

        <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <label className="block">
            <span className={fieldLabel}>From account</span>
            <Select value={fromAccountId} onValueChange={handleFromAccountChange} disabled={submitting}>
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
          </label>

          {canTransferOwn ? (
            <label className="block">
              <span className={fieldLabel}>To account</span>
              <Select value={toAccountId} onValueChange={setToAccountId} disabled={submitting}>
                <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {destinationAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {accountLabel(account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <div className="rounded-xl border border-border/70 bg-surface-2/40 px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
              Open at least two active Alta Bank accounts to move money between your own positions.
            </div>
          )}

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
