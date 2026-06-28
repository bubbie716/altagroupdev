import { useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROOF_BYTES, ACCEPTED_PROOF_INPUT } from "@/lib/storage/proof-upload.constants";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import { florin } from "@/lib/bank/api";
import { depositBlockedReason, formatBankActionError } from "@/lib/bank/account-status-copy";
import {
  BankRequestErrorCard,
  BankRequestSubmitButton,
  BankRequestSuccessCard,
  type BankRequestSubmissionResult,
} from "@/components/bank/bank-request-submission-ui";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

const ACCEPTED_PROOF_TYPES = ACCEPTED_PROOF_INPUT;

type FormView = "form" | "success" | "error";

function resolveInitialAccountId(accounts: UserBankAccount[], preferredAccountId?: string) {
  if (preferredAccountId && accounts.some((account) => account.id === preferredAccountId)) {
    return preferredAccountId;
  }
  return accounts[0]?.id ?? "";
}

export function BankDepositForm({
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
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [view, setView] = useState<FormView>("form");
  const [submitting, setSubmitting] = useState(false);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [submission, setSubmission] = useState<BankRequestSubmissionResult | null>(null);

  const proofInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const selectedAccount = accounts.find((account) => account.id === bankAccountId);

  function resetForm() {
    setView("form");
    setErrorReason(null);
    setSubmission(null);
    setAmount("");
    setMemo("");
    setProofFile(null);
    setBankAccountId(resolveInitialAccountId(accounts, defaultAccountId));
    if (proofInputRef.current) proofInputRef.current.value = "";
    queueMicrotask(() => amountInputRef.current?.focus());
  }

  function showError(message: string) {
    setErrorReason(message);
    setView("error");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const blocked = selectedAccount
      ? depositBlockedReason(selectedAccount.accountStatusInfo)
      : null;
    if (blocked) {
      showError(blocked);
      return;
    }

    if (!proofFile) {
      showError("Screenshot proof is required.");
      return;
    }

    if (proofFile.size > MAX_PROOF_BYTES) {
      showError("Proof file must be 8MB or smaller.");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("bankAccountId", bankAccountId);
      formData.append("amount", amount);
      formData.append("memo", memo);
      formData.append("proof", proofFile);

      const response = await fetch("/api/bank/deposit-request", {
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
        throw new Error(payload.message ?? "Proof upload failed. Please try again.");
      }

      const submittedAt = new Date().toISOString();
      const result: BankRequestSubmissionResult = {
        referenceCode: payload.referenceCode ?? "—",
        amount: Number(amount),
        submittedAt,
        accountName: selectedAccount?.accountName ?? "—",
        accountNumber: selectedAccount?.accountNumber ?? "—",
      };

      setSubmission(result);
      setView("success");
      onSubmissionSuccess?.(result);
      await router.invalidate();
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Proof upload failed. Please try again.";
      const formatted = formatBankActionError(raw, { action: "deposit", accountId: bankAccountId });
      showError(formatted.message);
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

  if (view === "success" && submission) {
    return (
      <BankRequestSuccessCard
        kind="deposit"
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
          Submit a Florin deposit with screenshot proof. Deposits are reviewed manually and balances update only
          after approval.
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
              ref={proofInputRef}
              type="file"
              accept={ACCEPTED_PROOF_TYPES}
              required
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-[13px] text-muted-foreground file:mr-4 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-2 file:text-[12px] file:font-medium disabled:opacity-60"
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              PNG, JPG, or WebP up to 8MB. Your screenshot is stored securely for Alta review.
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
        </fieldset>

        <BankRequestSubmitButton kind="deposit" submitting={submitting} disabled={!proofFile} />
      </Card>
    </form>
  );
}
