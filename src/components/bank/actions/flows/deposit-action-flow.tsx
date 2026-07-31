"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
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
import { isBankAccountPagePath } from "@/lib/bank/bank-account-page-path";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { isDepositFormDirty } from "@/lib/bank/bank-action-dirty";
import type { UserBankAccount } from "@/lib/bank/backend-types";
import { depositBlockedReason, formatBankActionError } from "@/lib/bank/account-status-copy";
import { usePostFinancialRefresh } from "@/hooks/use-post-financial-refresh";
import { MAX_PROOF_BYTES, ACCEPTED_PROOF_INPUT } from "@/lib/storage/proof-upload.constants";
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

const PROOF_HINT = "PNG, JPG, or WebP up to 8 MB. Only Alta reviewers can access it.";

export function DepositActionFlow({
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
  onPendingReference,
  accountContext,
}: BankActionFlowController & {
  accounts: UserBankAccount[];
  defaultAccountId?: string;
  onPendingReference?: (referenceCode: string) => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const context = useMemo(
    () => ({
      accountId: defaultAccountId ?? accountContext?.accountId,
      workspace: accountContext?.workspace,
      companyId: accountContext?.companyId,
    }),
    [defaultAccountId, accountContext],
  );

  const depositAccounts = useMemo(
    () => listAccountsForActionContext(accounts, context, "deposit"),
    [accounts, context],
  );

  const preferredAccountId = useMemo(
    () => resolvePreferredAccountId(accounts, context, "deposit"),
    [accounts, context],
  );

  const lockAccountSelection = isBankAccountPagePath(pathname, defaultAccountId);

  const [bankAccountId, setBankAccountId] = useState(() => preferredAccountId ?? "");
  const [amount, setAmount] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const {
    status: refreshStatus,
    refreshAfterSuccess,
    retryRefresh,
    reset: resetRefresh,
  } = usePostFinancialRefresh();
  const refreshPromiseRef = useRef<Promise<unknown> | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const submittingLockRef = useRef(false);
  const initialBankAccountIdRef = useRef(preferredAccountId ?? "");
  const selected = depositAccounts.find((a) => a.id === bankAccountId);

  // Keep the destination inside the eligible scope when context accounts load/change.
  useEffect(() => {
    if (!bankAccountId || !depositAccounts.some((a) => a.id === bankAccountId)) {
      const next = preferredAccountId ?? "";
      setBankAccountId(next);
      initialBankAccountIdRef.current = next;
    }
  }, [bankAccountId, depositAccounts, preferredAccountId]);

  const dirty = isDepositFormDirty({
    amount,
    hasProofFile: Boolean(proofFile),
    bankAccountId,
    initialBankAccountId: initialBankAccountIdRef.current,
  });

  useEffect(() => {
    setDirty(dirty && phase !== "success" && phase !== "submitting");
  }, [dirty, phase, setDirty]);

  // Promote selection → details when nested under another chooser.
  useEffect(() => {
    if (phase === "selection") setPhase("details");
  }, [phase, setPhase]);

  useEffect(() => {
    if (phase === "success") {
      setTitle("Deposit pending review");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "submitting") {
      setTitle("Deposit");
      setDescription(undefined);
      setShowBack(false);
      setFooter(null);
      registerBack(null);
      return;
    }
    if (phase === "review") {
      setTitle("Review deposit");
      setDescription("Confirm the details before submitting.");
      setShowBack(true);
      registerBack(() => setPhase("details"));
      return;
    }
    if (phase === "error") {
      setTitle("Deposit not submitted");
      setDescription("Your entries were preserved.");
      setShowBack(true);
      registerBack(() => setPhase("review"));
      setFooter(null);
      return;
    }
    setTitle("Deposit");
    setDescription("Submit a Florin deposit with proof for review.");
    setShowBack(false);
    registerBack(null);
  }, [phase, setTitle, setDescription, setShowBack, registerBack, setPhase, setFooter]);

  useEffect(() => {
    if (phase === "details") {
      setFooter(
        <BankActionFooter>
          <BankActionPrimaryButton
            disabled={!bankAccountId || !amount || Number(amount) <= 0 || !proofFile}
            onClick={() => {
              setDetailsError(null);
              const blocked = selected
                ? depositBlockedReason(selected.accountStatusInfo)
                : null;
              if (blocked) {
                setDetailsError(blocked);
                return;
              }
              if (!proofFile) {
                setDetailsError("Attach proof of your deposit to continue.");
                return;
              }
              if (proofFile.size > MAX_PROOF_BYTES) {
                setDetailsError("Proof file must be 8 MB or smaller.");
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
  }, [phase, bankAccountId, amount, proofFile, selected]);

  async function submit() {
    if (submittingLockRef.current || phase === "submitting" || !proofFile) return;
    submittingLockRef.current = true;
    setPhase("submitting");
    const startedAt = Date.now();

    try {
      if (shouldUseBankActionUiLabMock()) {
        const result = mockBankActionSubmission({
          kind: "deposit",
          amount: Number(amount),
          accountName: selected?.accountName,
          accountNumber: selected?.accountNumber,
        });
        await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
        setReferenceCode(result.referenceCode);
        onPendingReference?.(result.referenceCode);
        setPhase("success");
        const refreshPromise = refreshAfterSuccess("bank");
        refreshPromiseRef.current = refreshPromise;
        void refreshPromise.finally(() => {
          if (refreshPromiseRef.current === refreshPromise) {
            refreshPromiseRef.current = null;
          }
        });
        return;
      }

      const formData = new FormData();
      formData.append("bankAccountId", bankAccountId);
      formData.append("amount", amount);
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
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setReferenceCode(payload.referenceCode ?? "—");
      onPendingReference?.(payload.referenceCode ?? "—");
      setPhase("success");
      const refreshPromise = refreshAfterSuccess("bank");
      refreshPromiseRef.current = refreshPromise;
      void refreshPromise.finally(() => {
        if (refreshPromiseRef.current === refreshPromise) {
          refreshPromiseRef.current = null;
        }
      });
    } catch (err) {
      const raw =
        err instanceof Error ? err.message : "Proof upload failed. Please try again.";
      const formatted = formatBankActionError(raw, { action: "deposit", accountId: bankAccountId });
      setErrorReason(formatted.message);
      setPhase("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (depositAccounts.length === 0) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Open an active Alta Bank account before submitting a deposit request.
      </p>
    );
  }

  if (phase === "submitting") {
    return <BankActionProcessing label="Submitting deposit…" variant="progress" />;
  }

  if (phase === "success") {
    return (
      <BankActionSuccess
        kind="pending"
        title="Pending review"
        liveMessage={`Deposit of ${florin(Number(amount))} submitted and pending review.`}
        onDone={() => {
          void (async () => {
            if (refreshPromiseRef.current) {
              try {
                await refreshPromiseRef.current;
              } catch {
                /* soft — transaction already succeeded */
              }
            }
            resetRefresh();
            onDone();
          })();
        }}
        refreshStatus={refreshStatus === "idle" ? "refreshing" : refreshStatus}
        onRetryRefresh={() => {
          void retryRefresh();
        }}
        onMakeAnother={() => {
          setAmount("");
          setProofFile(null);
          setReferenceCode(null);
          setDetailsError(null);
          if (proofInputRef.current) proofInputRef.current.value = "";
          setPhase("details");
        }}
        makeAnotherLabel="Submit another"
        summary={[
          { label: "Amount", value: florin(Number(amount) || 0) },
          {
            label: "To",
            value: selected?.accountName ?? "—",
            secondary: selected ? formatAccountOptionSecondary(selected) : undefined,
          },
          ...(referenceCode ? [{ label: "Reference", value: referenceCode, mono: true }] : []),
        ]}
      >
        <p>An Alta reviewer checks your proof before the deposit posts.</p>
        <p>Funds are not available until approved.</p>
      </BankActionSuccess>
    );
  }

  if (phase === "error") {
    return (
      <BankProcessError
        message={errorReason ?? "Unable to submit deposit."}
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
              label: "To",
              value: selected?.accountName ?? "—",
              secondary: selected ? formatAccountOptionSecondary(selected) : undefined,
            },
            { label: "Amount", value: florin(Number(amount) || 0) },
            ...(proofFile ? [{ label: "Proof", value: proofFile.name }] : []),
          ]}
        />
        <p className="text-[13px] text-muted-foreground">
          You cannot cancel this request after submitting. Your balance updates only after
          approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <BankActionProgress step={1} total={3} label="Details" />

      {lockAccountSelection ? null : (
        <label className="block">
          <span className={fieldLabel}>Destination account</span>
          <Select value={bankAccountId} onValueChange={setBankAccountId}>
            <SelectTrigger className={inputClass} aria-label="Destination account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--menu-surface)]">
              {depositAccounts.map((account) => (
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
      )}

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
          aria-label="Deposit amount in Florin"
        />
      </label>

      <label className="block">
        <span className={fieldLabel}>Proof of deposit</span>
        <input
          ref={proofInputRef}
          type="file"
          accept={ACCEPTED_PROOF_INPUT}
          onChange={(e) => {
            setProofFile(e.target.files?.[0] ?? null);
            setDetailsError(null);
          }}
          className="mt-2 block w-full text-[13px] text-muted-foreground file:mr-4 file:min-h-11 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-2 file:text-[12px]"
        />
        <p className="mt-2 text-[12px] text-muted-foreground">{PROOF_HINT}</p>
      </label>

      {detailsError ? (
        <p className="text-[13px] text-destructive" role="alert">
          {detailsError}
        </p>
      ) : null}
    </div>
  );
}
