import { useRef, useState } from "react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";
import { WITHDRAW_FORM_INTRO } from "@/lib/bank/bank-shared-copy";
import {
  formatBankActionError,
  withdrawalBlockedReason,
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

function resolveInitialAccountId(accounts: UserBankAccount[], preferredAccountId?: string) {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) {
    return preferredAccountId;
  }
  return accounts[0]?.id ?? "";
}

export function BankWithdrawForm({
  accounts,
  defaultAccountId,
  onSubmissionSuccess,
}: {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
  onSubmissionSuccess?: (result: BankRequestSubmissionResult) => void;
}) {
  const [bankAccountId, setBankAccountId] = useState(() =>
    resolveInitialAccountId(accounts, defaultAccountId),
  );
  const selectedAccount = accounts.find((account) => account.id === bankAccountId);
  const availableBalance = selectedAccount?.availableBalance ?? selectedAccount?.balance ?? 0;
  const heldFunds = selectedAccount?.accountStatusInfo.heldFunds ?? 0;
  const [amount, setAmount] = useState("");
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
    setBankAccountId(resolveInitialAccountId(accounts, defaultAccountId));
    queueMicrotask(() => amountInputRef.current?.focus());
  }

  function showError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const withdrawalAmount = Number(amount);
    const blocked = selectedAccount
      ? withdrawalBlockedReason(selectedAccount.accountStatusInfo)
      : null;
    if (blocked) {
      showError(blocked);
      return;
    }
    if (withdrawalAmount > availableBalance) {
      showError(
        heldFunds > 0
          ? "This withdrawal couldn't be completed because your available balance is reduced by held funds."
          : "This withdrawal couldn't be completed because your available balance is insufficient.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("bankAccountId", bankAccountId);
      formData.append("amount", amount);

      const response = await fetch("/api/bank/withdrawal-request", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        referenceCode?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message ?? "Unable to submit withdrawal.");
      }

      const submittedAt = new Date().toISOString();
      const result: BankRequestSubmissionResult = {
        referenceCode: payload.referenceCode ?? "—",
        amount: withdrawalAmount,
        submittedAt,
        accountName: selectedAccount?.accountName ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? "—",
      };

      setSubmission(result);
      setView("success");
      onSubmissionSuccess?.(result);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unable to submit withdrawal.";
      const formatted = formatBankActionError(raw, {
        action: "withdraw",
        accountId: bankAccountId,
      });
      showError(formatted.message);
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

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="withdrawal"
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
          {WITHDRAW_FORM_INTRO}
        </p>

        <fieldset disabled={submitting} className="space-y-6 border-0 p-0 m-0 min-w-0">
          <label className="block">
            <span className={fieldLabel}>Bank account</span>
            <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={submitting}>
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
        </fieldset>

        <BankRequestSubmitButton
          kind="withdrawal"
          submitting={submitting}
          disabled={!amount || Number(amount) <= 0 || Number(amount) > availableBalance}
        />
      </Card>
    </form>
  );
}
