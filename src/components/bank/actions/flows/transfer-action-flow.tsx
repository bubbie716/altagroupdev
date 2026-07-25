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
import { ensureIdempotencyKey } from "@/lib/bank/bank-action-flow";
import {
  formatAccountOptionPrimary,
  formatAccountOptionSecondary,
  listAccountsForActionContext,
  listTransferDestinations,
  resolveTransferPair,
} from "@/lib/bank/bank-action-account-context";
import { waitBankProcessMin, BANK_PROCESS_MOTION } from "@/lib/bank/bank-process";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { submitBankInternalTransfer } from "@/lib/bank/bank.functions";
import { createUserScheduledTransferRecord } from "@/lib/bank/scheduled-transfer.functions";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import type { PaymentFrequencyCode } from "@/lib/bank/business-banking-types";
import {
  formatBankActionError,
  transferBlockedReason,
} from "@/lib/bank/account-status-copy";
import { DEFAULT_SCHEDULED_TIME_ET } from "@/lib/scheduled-datetime";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Timing = "now" | "scheduled" | "recurring";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-base sm:text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 disabled:opacity-60 min-h-11";

export function TransferActionFlow({
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
  onExitToChooser,
  accountContext,
  initialTiming = "now",
}: BankActionFlowController & {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
  onExitToChooser?: () => void;
  initialTiming?: Timing;
}) {
  const context = useMemo(
    () => ({
      accountId: defaultAccountId ?? accountContext?.accountId,
      workspace: accountContext?.workspace,
      companyId: accountContext?.companyId,
    }),
    [defaultAccountId, accountContext],
  );

  const sourceAccounts = useMemo(
    () => listAccountsForActionContext(accounts, context, "transfer_source"),
    [accounts, context],
  );

  const initialPair = useMemo(
    () => resolveTransferPair(accounts, context),
    [accounts, context],
  );

  const [fromAccountId, setFromAccountId] = useState(initialPair.fromAccountId);
  const [toAccountId, setToAccountId] = useState(initialPair.toAccountId);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [timing, setTiming] = useState<Timing>(initialTiming);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState(DEFAULT_SCHEDULED_TIME_ET);
  const [frequency, setFrequency] = useState<PaymentFrequencyCode>("monthly");
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingLockRef = useRef(false);

  // Keep From in scoped set when context accounts load/change.
  useEffect(() => {
    if (!fromAccountId || !sourceAccounts.some((a) => a.id === fromAccountId)) {
      setFromAccountId(initialPair.fromAccountId);
      setToAccountId(initialPair.toAccountId);
    }
  }, [fromAccountId, sourceAccounts, initialPair]);

  const destinations = useMemo(
    () => listTransferDestinations(accounts, context, fromAccountId),
    [accounts, context, fromAccountId],
  );

  const fromAccount = sourceAccounts.find((a) => a.id === fromAccountId) ??
    accounts.find((a) => a.id === fromAccountId);
  const toAccount = destinations.find((a) => a.id === toAccountId) ??
    accounts.find((a) => a.id === toAccountId);
  const availableBalance = fromAccount?.availableBalance ?? fromAccount?.balance ?? 0;

  useEffect(() => {
    if (toAccountId && !destinations.some((a) => a.id === toAccountId)) {
      setToAccountId(destinations[0]?.id ?? "");
    }
  }, [destinations, toAccountId]);

  const dirty =
    Boolean(amount.trim()) ||
    Boolean(memo.trim()) ||
    timing !== initialTiming ||
    Boolean(scheduledDate) ||
    fromAccountId !== initialPair.fromAccountId ||
    toAccountId !== initialPair.toAccountId;

  useEffect(() => {
    setDirty(dirty && phase !== "success" && phase !== "submitting");
  }, [dirty, phase, setDirty]);

  // Promote selection → details when nested under Move Money.
  useEffect(() => {
    if (phase === "selection") setPhase("details");
  }, [phase, setPhase]);

  useEffect(() => {
    if (phase === "success") {
      setTitle(timing === "now" ? "Transfer completed" : "Transfer scheduled");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "submitting") {
      setTitle("Transfer");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "review") {
      setTitle("Review transfer");
      setDescription("Confirm the details before sending.");
      setShowBack(true);
      registerBack(() => setPhase("details"));
      return;
    }
    if (phase === "error") {
      setTitle("Transfer unsuccessful");
      setDescription("Your entries were preserved.");
      setShowBack(true);
      registerBack(() => setPhase("review"));
      setFooter(null);
      return;
    }
    setTitle("Transfer");
    setDescription("Move money between your Alta accounts.");
    setShowBack(Boolean(onExitToChooser));
    registerBack(onExitToChooser ? () => onExitToChooser() : null);
  }, [
    phase,
    timing,
    setTitle,
    setDescription,
    setShowBack,
    registerBack,
    onExitToChooser,
    setPhase,
    setFooter,
  ]);

  useEffect(() => {
    if (phase === "details") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton
            disabled={
              sourceAccounts.length < 2 ||
              !fromAccountId ||
              !toAccountId ||
              fromAccountId === toAccountId ||
              !amount ||
              Number(amount) <= 0 ||
              (timing !== "now" && !scheduledDate)
            }
            onClick={() => {
              setDetailsError(null);
              if (fromAccountId === toAccountId) {
                setDetailsError("Choose two different accounts.");
                return;
              }
              if (timing === "now" && Number(amount) > availableBalance) {
                setDetailsError("Amount exceeds available balance.");
                return;
              }
              const blocked = fromAccount
                ? transferBlockedReason(fromAccount.accountStatusInfo, "source")
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
            {timing === "now" ? "Confirm transfer" : "Confirm schedule"}
          </BankActionPrimaryButton>
        </BankActionFooter>,
      );
    } else {
      setFooter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    fromAccountId,
    toAccountId,
    amount,
    timing,
    scheduledDate,
    availableBalance,
    fromAccount,
    sourceAccounts.length,
  ]);

  async function submit() {
    if (submittingLockRef.current || phase === "submitting") return;
    submittingLockRef.current = true;
    setPhase("submitting");
    const startedAt = Date.now();

    const transferAmount = Number(amount);
    try {
      if (shouldUseBankActionUiLabMock()) {
        const result = mockBankActionSubmission({
          kind: timing === "now" ? "transfer" : "schedule",
          amount: transferAmount,
          accountName: fromAccount?.accountName,
          accountNumber: fromAccount?.accountNumber,
        });
        await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
        setReferenceCode(result.referenceCode);
        setPhase("success");
        idempotencyKeyRef.current = null;
        return;
      }

      if (timing === "now") {
        const key = ensureIdempotencyKey(idempotencyKeyRef);
        const result = await submitBankInternalTransfer({
          data: {
            fromAccountId,
            toAccountId,
            amount: transferAmount,
            memo,
            idempotencyKey: key,
          },
        });
        setReferenceCode(result.referenceCode);
      } else {
        if (!toAccount) throw new Error("Select a destination account.");
        await createUserScheduledTransferRecord({
          data: {
            bankAccountId: fromAccountId,
            transferScope: "intrabank",
            paymentType: timing === "scheduled" ? "scheduled" : "recurring",
            recipientName: toAccount.accountName,
            recipientAccountNumber: toAccount.accountNumber,
            amount: transferAmount,
            scheduledDate: scheduledDate || undefined,
            scheduledTime: scheduledTime || undefined,
            frequency: timing === "recurring" ? frequency : undefined,
            memo: memo || undefined,
          },
        });
        setReferenceCode(timing === "scheduled" ? "SCHEDULED" : "RECURRING");
      }
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      idempotencyKeyRef.current = null;
      setPhase("success");
    } catch (err) {
      const raw =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Unable to complete transfer.";
      const formatted = formatBankActionError(raw, {
        action: "transfer",
        accountId: fromAccountId,
      });
      setErrorReason(formatted.message);
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (sourceAccounts.length < 2) {
    return (
      <p className="text-[14px] text-muted-foreground">
        You need at least two eligible accounts in this workspace to transfer between them.
      </p>
    );
  }

  if (phase === "submitting") {
    return (
      <BankActionProcessing
        label={timing === "now" ? "Sending transfer…" : "Scheduling transfer…"}
        variant="transfer"
      />
    );
  }

  if (phase === "success") {
    return (
      <BankActionSuccess
        title={timing === "now" ? "Transfer completed" : "Transfer scheduled"}
        liveMessage={
          timing === "now"
            ? `Transferred ${florin(Number(amount))} to ${toAccount?.accountName ?? "destination"}.`
            : "Scheduled transfer created."
        }
        onDone={onDone}
        summary={[
          { label: "Amount", value: florin(Number(amount) || 0) },
          {
            label: "To",
            value: toAccount?.accountName ?? "—",
            secondary: toAccount ? formatAccountOptionSecondary(toAccount) : undefined,
          },
          ...(referenceCode && referenceCode !== "SCHEDULED" && referenceCode !== "RECURRING"
            ? [{ label: "Reference", value: referenceCode, mono: true }]
            : []),
        ]}
      />
    );
  }

  if (phase === "error") {
    return (
      <BankProcessError
        message={errorReason ?? "Unable to complete transfer."}
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
              value: fromAccount?.accountName ?? "—",
              secondary: fromAccount ? formatAccountOptionSecondary(fromAccount) : undefined,
            },
            {
              label: "To",
              value: toAccount?.accountName ?? "—",
              secondary: toAccount ? formatAccountOptionSecondary(toAccount) : undefined,
            },
            { label: "Amount", value: florin(Number(amount) || 0) },
            ...(timing === "now"
              ? [
                  {
                    label: "Available after",
                    value: florin(Math.max(0, availableBalance - (Number(amount) || 0))),
                  },
                ]
              : [
                  { label: "When", value: timing === "scheduled" ? "Scheduled" : "Recurring" },
                  {
                    label: "First run",
                    value: `${scheduledDate} · ${scheduledTime} ET`,
                  },
                  ...(timing === "recurring"
                    ? [{ label: "Frequency", value: frequency }]
                    : []),
                ]),
            ...(memo.trim() ? [{ label: "Memo", value: memo }] : []),
          ]}
        />
      </div>
    );
  }

  // details (also renders for brief selection→details promotion)
  return (
    <div className="space-y-5">
      <BankActionProgress step={1} total={3} label="Details" />

      <label className="block">
        <span className={fieldLabel}>From</span>
        <Select
          value={fromAccountId}
          onValueChange={(next) => {
            setFromAccountId(next);
            if (next === toAccountId) {
              const alt = listTransferDestinations(accounts, context, next)[0];
              setToAccountId(alt?.id ?? "");
            }
          }}
        >
          <SelectTrigger className={inputClass} aria-label="From account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--menu-surface)]">
            {sourceAccounts.map((account) => (
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
        <span className={fieldLabel}>To</span>
        <Select value={toAccountId} onValueChange={setToAccountId}>
          <SelectTrigger className={inputClass} aria-label="To account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--menu-surface)]">
            {destinations.map((account) => (
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
      </label>

      <label className="block">
        <span className={fieldLabel}>Amount (ƒ)</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} tabular-nums text-foreground`}
          aria-label="Transfer amount in Florin"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className={fieldLabel}>When</legend>
        {(
          [
            ["now", "Now"],
            ["scheduled", "Scheduled"],
            ["recurring", "Recurring"],
          ] as const
        ).map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3"
          >
            <input
              type="radio"
              name="transfer-timing"
              value={value}
              checked={timing === value}
              onChange={() => setTiming(value)}
            />
            <span className="text-[14px]">{label}</span>
          </label>
        ))}
      </fieldset>

      {timing !== "now" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={fieldLabel}>{timing === "recurring" ? "Start date" : "Date"}</span>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Time (Eastern)</span>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      ) : null}

      {timing === "recurring" ? (
        <label className="block">
          <span className={fieldLabel}>Frequency</span>
          <select
            className={inputClass}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as PaymentFrequencyCode)}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className={fieldLabel}>Memo (optional)</span>
        <Textarea
          autoResize
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          className={`${inputClass} min-h-[80px]`}
        />
      </label>

      {detailsError ? (
        <p className="text-[13px] text-destructive" role="alert">
          {detailsError}
        </p>
      ) : null}
    </div>
  );
}
