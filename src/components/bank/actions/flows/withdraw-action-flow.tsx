"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionProcessing,
  BankActionProgress,
  BankActionSuccess,
} from "@/components/bank/actions/bank-action-chrome";
import {
  BankProcessError,
  BankProcessSummary,
} from "@/components/bank/actions/bank-process-ui";
import type { BankActionFlowController } from "@/components/bank/actions/bank-action-flow-types";
import { florin } from "@/lib/bank/api";
import {
  formatAccountOptionPrimary,
  formatAccountOptionSecondary,
  listAccountsForActionContext,
  resolvePreferredAccountId,
} from "@/lib/bank/bank-action-account-context";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import {
  formatBankActionError,
  withdrawalBlockedReason,
} from "@/lib/bank/account-status-copy";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

const DESTINATION_PLACEHOLDER = "Bank name, account number, and any routing notes";

export function WithdrawActionFlow({
  accounts,
  defaultAccountId,
  phase,
  setPhase,
  setTitle,
  setDescription,
  setDirty,
  setShowBack,
  setFooter,
  registerBack,
  onDone,
  accountContext,
}: BankActionFlowController & {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
}) {
  const context = useMemo(
    () => ({
      accountId: defaultAccountId ?? accountContext?.accountId,
      workspace: accountContext?.workspace,
      companyId: accountContext?.companyId,
    }),
    [defaultAccountId, accountContext],
  );

  const withdrawAccounts = useMemo(
    () => listAccountsForActionContext(accounts, context, "withdraw"),
    [accounts, context],
  );

  const preferredAccountId = useMemo(
    () => resolvePreferredAccountId(accounts, context, "withdraw"),
    [accounts, context],
  );

  const [bankAccountId, setBankAccountId] = useState(() => preferredAccountId ?? "");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const submittingLockRef = useRef(false);
  const selected = withdrawAccounts.find((a) => a.id === bankAccountId);
  const availableBalance = selected?.availableBalance ?? selected?.balance ?? 0;

  // Keep the source inside the eligible scope when context accounts load/change.
  useEffect(() => {
    if (!bankAccountId || !withdrawAccounts.some((a) => a.id === bankAccountId)) {
      setBankAccountId(preferredAccountId ?? "");
    }
  }, [bankAccountId, withdrawAccounts, preferredAccountId]);

  useEffect(() => {
    setDirty(
      Boolean(amount || destination) && phase !== "success" && phase !== "submitting",
    );
  }, [amount, destination, phase, setDirty]);

  // Promote selection → details when nested under another chooser.
  useEffect(() => {
    if (phase === "selection") setPhase("details");
  }, [phase, setPhase]);

  useEffect(() => {
    if (phase === "success") {
      setTitle("Withdrawal pending review");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "submitting") {
      setTitle("Withdraw");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "review") {
      setTitle("Review withdrawal");
      setDescription("Confirm the details before submitting.");
      setShowBack(true);
      registerBack(() => setPhase("details"));
      return;
    }
    if (phase === "error") {
      setTitle("Withdrawal not submitted");
      setDescription("Your entries were preserved.");
      setShowBack(true);
      registerBack(() => setPhase("review"));
      setFooter(null);
      return;
    }
    setTitle("Withdraw");
    setDescription("Request a withdrawal from an eligible account.");
    setShowBack(false);
    registerBack(null);
  }, [phase, setTitle, setDescription, setShowBack, registerBack, setPhase, setFooter]);

  useEffect(() => {
    if (phase === "details") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton
            disabled={
              !bankAccountId ||
              !amount ||
              Number(amount) <= 0 ||
              Number(amount) > availableBalance ||
              !destination.trim()
            }
            onClick={() => {
              setDetailsError(null);
              if (Number(amount) > availableBalance) {
                setDetailsError("Amount exceeds available balance.");
                return;
              }
              const blocked = selected
                ? withdrawalBlockedReason(selected.accountStatusInfo)
                : null;
              if (blocked) {
                setDetailsError(blocked);
                return;
              }
              setPhase("review");
            }}
          >
            Continue
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else if (phase === "review") {
      // Header Back only — avoid duplicate footer Back.
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton onClick={() => void submit()}>
            Submit for review
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else {
      setFooter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bankAccountId, amount, destination, availableBalance, selected]);

  async function submit() {
    if (submittingLockRef.current || phase === "submitting") return;
    submittingLockRef.current = true;
    setPhase("submitting");
    const startedAt = Date.now();

    try {
      if (shouldUseBankActionUiLabMock()) {
        const result = mockBankActionSubmission({
          kind: "withdraw",
          amount: Number(amount),
          accountName: selected?.accountName,
          accountNumber: selected?.accountNumber,
        });
        await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
        setReferenceCode(result.referenceCode);
        setPhase("success");
        return;
      }

      const formData = new FormData();
      formData.append("bankAccountId", bankAccountId);
      formData.append("amount", amount);
      formData.append("memo", destination.trim());
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
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setReferenceCode(payload.referenceCode ?? "—");
      setPhase("success");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unable to submit withdrawal.";
      const formatted = formatBankActionError(raw, {
        action: "withdraw",
        accountId: bankAccountId,
      });
      setErrorReason(formatted.message);
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (withdrawAccounts.length === 0) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Open an active Alta Bank account before submitting a withdrawal request.
      </p>
    );
  }

  if (phase === "submitting") {
    return <BankActionProcessing label="Submitting withdrawal…" variant="progress" />;
  }

  if (phase === "success") {
    return (
      <BankActionSuccess
        kind="pending"
        title="Pending review"
        liveMessage={`Withdrawal of ${florin(Number(amount))} submitted and pending review.`}
        onDone={onDone}
        onMakeAnother={() => {
          setAmount("");
          setDestination("");
          setReferenceCode(null);
          setDetailsError(null);
          setPhase("details");
        }}
        makeAnotherLabel="Submit another"
        summary={[
          { label: "Amount", value: florin(Number(amount) || 0) },
          {
            label: "From",
            value: selected?.accountName ?? "—",
            secondary: selected ? formatAccountOptionSecondary(selected) : undefined,
          },
          ...(referenceCode ? [{ label: "Reference", value: referenceCode, mono: true }] : []),
        ]}
      >
        <p>An Alta reviewer processes your request and sends the funds.</p>
        <p>This is not completed until approved.</p>
      </BankActionSuccess>
    );
  }

  if (phase === "error") {
    return (
      <BankProcessError
        message={errorReason ?? "Unable to submit withdrawal."}
        onEdit={() => setPhase("details")}
        onRetry={() => setPhase("review")}
      />
    );
  }

  if (phase === "review") {
    return (
      <div className="space-y-4">
        <BankActionProgress step={2} total={3} label="Review" />
        <BankProcessSummary
          rows={[
            {
              label: "From",
              value: selected?.accountName ?? "—",
              secondary: selected ? formatAccountOptionSecondary(selected) : undefined,
            },
            { label: "Amount", value: florin(Number(amount) || 0) },
            { label: "Fee", value: florin(0) },
            { label: "Destination", value: destination },
          ]}
        />
        <p className="text-[13px] text-muted-foreground">
          You cannot cancel this request after submitting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BankActionProgress step={1} total={3} label="Details" />

      <label className="block">
        <span className={fieldLabel}>Source account</span>
        <Select value={bankAccountId} onValueChange={setBankAccountId}>
          <SelectTrigger className={inputClass} aria-label="Source account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--menu-surface)]">
            {withdrawAccounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <span className="block min-w-0">
                  <span className="block truncate font-medium">
                    {formatAccountOptionPrimary(account)}
                  </span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {formatAccountOptionSecondary(account)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Available {florin(availableBalance)}
        </p>
      </label>

      <label className="block">
        <span className={fieldLabel}>Amount (ƒ)</span>
        <input
          type="number"
          min="0.01"
          max={availableBalance > 0 ? availableBalance : undefined}
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} tabular-nums text-foreground`}
          aria-label="Withdrawal amount in Florin"
        />
      </label>

      <label className="block">
        <span className={fieldLabel}>Destination details</span>
        <Textarea
          autoResize
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder={DESTINATION_PLACEHOLDER}
          aria-label="Destination details"
        />
        <p className="mt-2 text-[12px] text-muted-foreground">
          Tell us where to send the funds. An Alta reviewer approves every withdrawal before it
          is sent.
        </p>
      </label>

      {detailsError ? (
        <p className="text-[13px] text-destructive" role="alert">
          {detailsError}
        </p>
      ) : null}
    </div>
  );
}
