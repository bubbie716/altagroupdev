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
import { submitBankInternalTransfer } from "@/lib/bank/bank.functions";
import type { SubmitInternalTransferInput, TransferContact, UserBankAccount } from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";
import { TransferContactPicker } from "@/components/bank/bank-transfer-contacts-manager";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

const ACCOUNT_NUMBER_PATTERN = /^AB-\d{4}-\d{6}$/;

type TransferMode = "own" | "player";

function accountLabel(account: UserBankAccount) {
  const owner = account.companyName ?? "Personal";
  return `${account.accountName} · ${account.accountNumber} · ${florin(account.balance)} · ${owner}`;
}

export function BankInternalTransferForm({
  accounts,
  contacts = [],
  onSuccess,
}: {
  accounts: UserBankAccount[];
  contacts?: TransferContact[];
  onSuccess?: () => void;
}) {
  const canTransferOwn = accounts.length >= 2;
  const [transferMode, setTransferMode] = useState<TransferMode>(canTransferOwn ? "own" : "player");

  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [toAccountNumber, setToAccountNumber] = useState("");

  const fromAccount = accounts.find((account) => account.id === fromAccountId);
  const availableBalance = fromAccount?.balance ?? 0;
  const destinationAccounts = accounts.filter((account) => account.id !== fromAccountId);

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const normalizedAccountNumber = toAccountNumber.trim().toUpperCase();
  const accountNumberValid =
    normalizedAccountNumber.length === 0 || ACCOUNT_NUMBER_PATTERN.test(normalizedAccountNumber);

  function handleFromAccountChange(nextFromAccountId: string) {
    setFromAccountId(nextFromAccountId);
    if (transferMode === "own" && nextFromAccountId === toAccountId) {
      const fallback = accounts.find((account) => account.id !== nextFromAccountId);
      setToAccountId(fallback?.id ?? "");
    }
  }

  function handleTransferModeChange(nextMode: TransferMode) {
    setTransferMode(nextMode);
    setError(null);
    setSuccess(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const transferAmount = Number(amount);
    if (transferAmount > availableBalance) {
      setError("Insufficient balance for this transfer.");
      return;
    }

    if (transferMode === "player" && !ACCOUNT_NUMBER_PATTERN.test(normalizedAccountNumber)) {
      setError("Enter a valid Alta Bank account number (AB-####-######).");
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
      setSuccess(`Transfer completed. Reference: ${result.referenceCode}`);
      setAmount("");
      setMemo("");
      if (transferMode === "player") setToAccountNumber("");
      onSuccess?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to complete transfer.";
      setError(message);
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

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canTransferOwn}
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
          onClick={() => handleTransferModeChange("player")}
          className={`rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
            transferMode === "player"
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-border-strong"
          }`}
        >
          Another player
        </button>
      </div>

      <label className="block">
        <span className={fieldLabel}>From account</span>
        <Select value={fromAccountId} onValueChange={handleFromAccountChange}>
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
            <Select value={toAccountId} onValueChange={setToAccountId}>
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
          <Card className="!p-4 text-[13px] text-muted-foreground">
            Open at least two active Alta Bank accounts to transfer between them, or send to another
            player.
          </Card>
        )
      ) : (
        <>
          <TransferContactPicker contacts={contacts} onSelect={setToAccountNumber} />
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
        disabled={submitting || !(canSubmitOwn || canSubmitPlayer)}
        className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium tracking-wide text-background disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Transferring…" : "Transfer funds"}
      </button>
    </form>
  );
}
