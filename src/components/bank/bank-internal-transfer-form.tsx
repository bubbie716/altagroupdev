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
import type { SubmitInternalTransferInput, TransferContact, UserBankAccount } from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";
import { INTRABANK_TRANSFER_FORM_INTRO } from "@/lib/bank/bank-shared-copy";
import {
  formatBankActionError,
  transferBlockedReason,
} from "@/lib/bank/account-status-copy";
import { TransferContactPicker } from "@/components/bank/bank-transfer-contacts-manager";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

const ACCOUNT_NUMBER_PATTERN = /^AB-\d{4}-\d{6}$/;

type TransferMode = "own" | "player";
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
  contacts = [],
  defaultFromAccountId,
  onSuccess,
  onSubmissionSuccess,
}: {
  accounts: UserBankAccount[];
  contacts?: TransferContact[];
  defaultFromAccountId?: string;
  onSuccess?: () => void;
  onSubmissionSuccess?: (result: BankRequestSubmissionResult) => void;
}) {
  const canTransferOwn = accounts.length >= 2;
  const [transferMode, setTransferMode] = useState<TransferMode>(canTransferOwn ? "own" : "player");

  const [fromAccountId, setFromAccountId] = useState(() =>
    resolveInitialFromAccountId(accounts, defaultFromAccountId),
  );
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [toAccountNumber, setToAccountNumber] = useState("");

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

  const normalizedAccountNumber = toAccountNumber.trim().toUpperCase();
  const accountNumberValid =
    normalizedAccountNumber.length === 0 || ACCOUNT_NUMBER_PATTERN.test(normalizedAccountNumber);

  function resetForm() {
    setView("form");
    setErrorReason(null);
    setSubmission(null);
    setAmount("");
    setMemo("");
    setToAccountNumber("");
    setFromAccountId(resolveInitialFromAccountId(accounts, defaultFromAccountId));
    setTransferMode(canTransferOwn ? "own" : "player");
    queueMicrotask(() => amountInputRef.current?.focus());
  }

  function showError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  function handleFromAccountChange(nextFromAccountId: string) {
    setFromAccountId(nextFromAccountId);
    if (transferMode === "own" && nextFromAccountId === toAccountId) {
      const fallback = accounts.find((account) => account.id !== nextFromAccountId);
      setToAccountId(fallback?.id ?? "");
    }
  }

  function handleTransferModeChange(nextMode: TransferMode) {
    setTransferMode(nextMode);
    setErrorReason(null);
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

    if (transferMode === "player" && !ACCOUNT_NUMBER_PATTERN.test(normalizedAccountNumber)) {
      showError("Enter a valid Alta Bank account number (AB-####-######).");
      return;
    }

    setSubmitting(true);

    try {
      const input: SubmitInternalTransferInput =
        transferMode === "own"
          ? {
              fromAccountId,
              toAccountId,
              amount: transferAmount,
              memo,
            }
          : {
              fromAccountId,
              toAccountNumber: normalizedAccountNumber,
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

  const canSubmitOwn =
    transferMode === "own" &&
    !!fromAccountId &&
    !!toAccountId &&
    fromAccountId !== toAccountId &&
    !!amount &&
    Number(amount) > 0 &&
    Number(amount) <= availableBalance;

  const canSubmitPlayer =
    transferMode === "player" &&
    !!fromAccountId &&
    !!normalizedAccountNumber &&
    accountNumberValid &&
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canTransferOwn || submitting}
            onClick={() => handleTransferModeChange("own")}
            className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              transferMode === "own"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-border-strong"
            }`}
          >
            My accounts
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleTransferModeChange("player")}
            className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              transferMode === "player"
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-border-strong"
            }`}
          >
            Another player
          </button>
        </div>

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

          {transferMode === "own" ? (
            canTransferOwn ? (
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
                Open at least two active Alta Bank accounts to transfer between them, or send to
                another player.
              </div>
            )
          ) : (
            <>
              <TransferContactPicker
                contacts={contacts}
                onSelect={(contact) => {
                  if (contact.accountNumber) setToAccountNumber(contact.accountNumber);
                }}
              />
              <label className="block">
                <span className={fieldLabel}>Recipient account number</span>
                <input
                  type="text"
                  required
                  value={toAccountNumber}
                  onChange={(e) => setToAccountNumber(e.target.value)}
                  placeholder="AB-2000-482913"
                  className={`${inputClass} font-mono uppercase`}
                />
                {!accountNumberValid && (
                  <p className="mt-2 text-[12px] text-destructive">
                    Account numbers use the format AB-####-######
                  </p>
                )}
              </label>
            </>
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
          disabled={!(canSubmitOwn || canSubmitPlayer)}
        />
      </Card>
    </form>
  );
}
