"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import {
  applyManualInterestApplicationRecord,
  previewManualInterestApplicationRecord,
  scheduleManualInterestApplicationRecord,
  type ManualInterestApplyResult,
  type ManualInterestPreviewResult,
  type ScheduleManualInterestResult,
} from "@/lib/bank/manual-interest.functions";
import {
  MANUAL_INTEREST_CATEGORY_OPTIONS,
  MANUAL_INTEREST_CONFIRMATION_PHRASE,
  type ManualInterestApplicationInput,
  type ManualInterestCategoryCode,
  type ManualInterestMode,
} from "@/lib/bank/manual-interest-types";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdmin } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const fieldLabel = "type-meta";
const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]";

type Step = "form" | "preview" | "confirm" | "result" | "scheduled";

export function InternalManualInterestOps() {
  const router = useRouter();
  const user = useCurrentUser();
  const canApply = user ? isAdmin(user) : false;

  const previewFn = useServerFn(previewManualInterestApplicationRecord);
  const applyFn = useServerFn(applyManualInterestApplicationRecord);
  const scheduleFn = useServerFn(scheduleManualInterestApplicationRecord);

  const [step, setStep] = useState<Step>("form");
  const [mode, setMode] = useState<ManualInterestMode>("PERCENTAGE");
  const [percentageRate, setPercentageRate] = useState("2");
  const [fixedAmount, setFixedAmount] = useState("500");
  const [selectedCategories, setSelectedCategories] = useState<ManualInterestCategoryCode[]>([
    "savings",
  ]);
  const [reason, setReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [scheduledForDate, setScheduledForDate] = useState("");
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<ManualInterestPreviewResult | null>(null);
  const [result, setResult] = useState<ManualInterestApplyResult | null>(null);
  const [scheduleResult, setScheduleResult] = useState<ScheduleManualInterestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const allSelected = selectedCategories.includes("all");

  const formInput = useMemo((): ManualInterestApplicationInput => {
    return {
      mode,
      percentageRate: mode === "PERCENTAGE" ? Number(percentageRate) : undefined,
      fixedAmount: mode === "FIXED_AMOUNT" ? Number(fixedAmount) : undefined,
      accountTypes: allSelected ? ["all"] : selectedCategories,
      reason: reason.trim(),
      internalNote: internalNote.trim() || undefined,
      scheduledForDate: scheduledForDate.trim() || undefined,
      idempotencyKey: idempotencyKey ?? undefined,
    };
  }, [
    mode,
    percentageRate,
    fixedAmount,
    allSelected,
    selectedCategories,
    reason,
    internalNote,
    scheduledForDate,
    idempotencyKey,
  ]);

  function toggleCategory(value: ManualInterestCategoryCode) {
    if (value === "all") {
      setSelectedCategories((current) => (current.includes("all") ? [] : ["all"]));
      return;
    }
    setSelectedCategories((current) => {
      const withoutAll = current.filter((item) => item !== "all");
      if (withoutAll.includes(value)) {
        return withoutAll.filter((item) => item !== value);
      }
      return [...withoutAll, value];
    });
  }

  async function handlePreview() {
    setPending(true);
    setError(null);
    try {
      const previewResult = await previewFn({ data: formInput });
      setPreview(previewResult);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPending(false);
    }
  }

  function handleProceedToConfirm() {
    setIdempotencyKey(crypto.randomUUID());
    setConfirmationPhrase("");
    setStep("confirm");
  }

  const isScheduling = Boolean(scheduledForDate.trim());

  async function handleApply() {
    if (!idempotencyKey) return;
    setPending(true);
    setError(null);
    try {
      const payload = {
        ...formInput,
        idempotencyKey,
        confirmationPhrase,
      };

      if (isScheduling) {
        const scheduled = await scheduleFn({ data: payload });
        setScheduleResult(scheduled);
        setStep("scheduled");
      } else {
        const applyResult = await applyFn({ data: payload });
        setResult(applyResult);
        setStep("result");
      }
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : isScheduling ? "Schedule failed" : "Apply failed");
    } finally {
      setPending(false);
    }
  }

  function resetFlow() {
    setStep("form");
    setPreview(null);
    setResult(null);
    setScheduleResult(null);
    setError(null);
    setConfirmationPhrase("");
    setIdempotencyKey(null);
  }

  return (
    <div className="space-y-8">
      {step === "form" && (
        <section className="space-y-6 rounded-lg border border-border/60 bg-surface-2/20 p-5">
          <div>
            <h3 className="text-base font-medium tracking-tight">Interest application form</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Manually credit interest to selected account categories. Preview before applying, or
              pick a schedule date to run automatically via the platform cron.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>Application mode</label>
              <select
                className={inputClass}
                value={mode}
                onChange={(e) => setMode(e.target.value as ManualInterestMode)}
              >
                <option value="PERCENTAGE">Percentage credit</option>
                <option value="FIXED_AMOUNT">Fixed amount (split total)</option>
              </select>
            </div>
            <div>
              {mode === "PERCENTAGE" ? (
                <>
                  <label className={fieldLabel}>Percentage rate (%)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={inputClass}
                    value={percentageRate}
                    onChange={(e) => setPercentageRate(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <label className={fieldLabel}>Total amount to split (ƒ)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className={inputClass}
                    value={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.value)}
                  />
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Split equally among eligible accounts (not per account).
                  </p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className={fieldLabel}>Account categories</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MANUAL_INTEREST_CATEGORY_OPTIONS.map((option) => {
                const checked = selectedCategories.includes(option.value);
                const disabled = option.value !== "all" && allSelected;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-[13px]",
                      disabled && "cursor-not-allowed opacity-50",
                      checked && "border-gold/40 bg-gold/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleCategory(option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Only active accounts with a balance above zero in the selected categories receive
              interest. Frozen, closed, and zero-balance accounts are excluded automatically.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={fieldLabel}>Reason (required)</label>
              <input
                type="text"
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Monthly promotional credit"
              />
            </div>
            <div>
              <label className={fieldLabel}>Internal note</label>
              <input
                type="text"
                className={inputClass}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Ops reference or campaign ID"
              />
            </div>
            <div>
              <label className={fieldLabel}>Schedule date (optional)</label>
              <input
                type="date"
                className={inputClass}
                value={scheduledForDate}
                onChange={(e) => setScheduledForDate(e.target.value)}
              />
              <p className="mt-1 text-[12px] text-muted-foreground">
                Leave blank to apply immediately. When set, credits run at 9:00 AM Eastern on that
                date via the shared cron job.
              </p>
            </div>
          </div>

          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

          <button
            type="button"
            disabled={pending || !reason.trim() || selectedCategories.length === 0}
            onClick={() => void handlePreview()}
            className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
          >
            {pending ? "Previewing…" : "Preview affected accounts"}
          </button>
        </section>
      )}

      {step === "preview" && preview && (
        <PreviewSection
          preview={preview}
          onBack={() => setStep("form")}
          onConfirm={handleProceedToConfirm}
          canApply={canApply}
        />
      )}

      {step === "confirm" && preview && (
        <section className="space-y-4 rounded-lg border border-gold/30 bg-gold/5 p-5">
          <h3 className="text-base font-medium tracking-tight">Confirm application</h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {isScheduling ? (
              <>
                You are about to schedule an interest credit for{" "}
                <span className="font-medium text-foreground">{preview.affectedAccountCount}</span>{" "}
                account(s) totaling{" "}
                <span className="type-finance font-medium text-foreground">
                  {florin(preview.totalInterestToCredit)}
                </span>{" "}
                on{" "}
                <span className="font-medium text-foreground">{scheduledForDate}</span> (9:00 AM
                Eastern). Balances will be evaluated when the job runs.
              </>
            ) : (
              <>
                You are about to credit interest to{" "}
                <span className="font-medium text-foreground">{preview.affectedAccountCount}</span>{" "}
                account(s) totaling{" "}
                <span className="type-finance font-medium text-foreground">
                  {florin(preview.totalInterestToCredit)}
                </span>
                . This will create permanent transaction records.
              </>
            )}
          </p>
          {!canApply ? (
            <p className="text-[13px] text-muted-foreground">
              Admin access is required to apply interest. Operators may preview only.
            </p>
          ) : (
            <>
              <div>
                <label className={fieldLabel}>
                  Type {MANUAL_INTEREST_CONFIRMATION_PHRASE} to confirm
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  placeholder={MANUAL_INTEREST_CONFIRMATION_PHRASE}
                />
              </div>
              {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep("preview")}
                  className="rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={
                    pending || confirmationPhrase.trim() !== MANUAL_INTEREST_CONFIRMATION_PHRASE
                  }
                  onClick={() => void handleApply()}
                  className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
                >
                  {pending
                    ? isScheduling
                      ? "Scheduling…"
                      : "Applying…"
                    : isScheduling
                      ? "Schedule interest credit"
                      : "Apply interest credit"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {step === "result" && result && (
        <ResultSection result={result} onReset={resetFlow} />
      )}

      {step === "scheduled" && scheduleResult && (
        <section className="space-y-4 rounded-lg border border-border/60 bg-surface-2/20 p-5">
          <div>
            <h3 className="text-base font-medium tracking-tight">Interest application scheduled</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              This batch will run automatically at 9:00 AM Eastern on{" "}
              {scheduleResult.scheduledFor.slice(0, 10)}.
            </p>
          </div>
          <p className="font-mono text-[12px] text-muted-foreground">
            Reference: <span className="text-foreground">{scheduleResult.id}</span>
          </p>
          <button
            type="button"
            onClick={resetFlow}
            className="rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
          >
            Start new application
          </button>
        </section>
      )}
    </div>
  );
}

function PreviewSection({
  preview,
  onBack,
  onConfirm,
  canApply,
}: {
  preview: ManualInterestPreviewResult;
  onBack: () => void;
  onConfirm: () => void;
  canApply: boolean;
}) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Affected accounts" value={String(preview.affectedAccountCount)} />
        <InternalStatCard label="Skipped accounts" value={String(preview.skippedAccountCount)} />
        <InternalStatCard
          label="Total interest"
          value={florin(preview.totalInterestToCredit)}
        />
        <InternalStatCard
          label="Average credit"
          value={florin(preview.estimatedAverageCredit)}
        />
      </div>

      <div className="rounded-lg border border-border/60 bg-surface-2/20 p-4 text-[13px] text-muted-foreground">
        <p>
          Categories:{" "}
          <span className="text-foreground">{preview.selectedCategoryLabels.join(", ")}</span>
        </p>
        <p className="mt-1">
          Total balances affected:{" "}
          <span className="type-finance text-foreground">
            {florin(preview.totalBalancesAffected)}
          </span>
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-base font-medium tracking-tight">Preview — eligible accounts</h3>
        <AdminDataTable
          columns={previewColumns()}
          rows={preview.accounts}
          rowKey={(row) => row.accountId}
        />
      </div>

      {preview.skippedAccounts.length > 0 && (
        <div>
          <h3 className="mb-3 text-base font-medium tracking-tight">Skipped accounts</h3>
          <AdminDataTable
            columns={skippedColumns()}
            rows={preview.skippedAccounts}
            rowKey={(row) => row.accountId}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
        >
          Edit form
        </button>
        {canApply && preview.affectedAccountCount > 0 ? (
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-gold"
          >
            Continue to confirmation
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ResultSection({
  result,
  onReset,
}: {
  result: ManualInterestApplyResult;
  onReset: () => void;
}) {
  const processed = result.results.filter((row) => row.status === "processed");

  return (
    <section className="space-y-6 rounded-lg border border-border/60 bg-surface-2/20 p-5">
      <div>
        <h3 className="text-base font-medium tracking-tight">Interest application complete</h3>
        {result.idempotentReplay ? (
          <p className="mt-1 text-[13px] text-muted-foreground">
            This batch was already applied (idempotent replay).
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Processed" value={String(result.processedCount)} />
        <InternalStatCard label="Skipped" value={String(result.skippedCount)} />
        <InternalStatCard label="Failed" value={String(result.failedCount)} />
        <InternalStatCard
          label="Total credited"
          value={florin(result.totalInterestCredited)}
        />
      </div>

      <p className="font-mono text-[12px] text-muted-foreground">
        Batch reference:{" "}
        <span className="text-foreground">{result.batchReferenceId}</span>
      </p>

      {processed.length > 0 && (
        <AdminDataTable
          columns={[
            {
              key: "account",
              header: "Account",
              cell: (row) => (
                <span className="font-mono text-[11px]">{row.accountNumber}</span>
              ),
            },
            {
              key: "amount",
              header: "Credited",
              cell: (row) => (
                <span className="type-finance">{florin(row.interestAmount ?? 0)}</span>
              ),
            },
            {
              key: "ref",
              header: "Reference",
              cell: (row) => (
                <span className="font-mono text-[10px]">{row.referenceCode ?? "—"}</span>
              ),
            },
          ]}
          rows={processed}
          rowKey={(row) => row.accountId}
        />
      )}

      <button
        type="button"
        onClick={onReset}
        className="rounded-md border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
      >
        Start new application
      </button>
    </section>
  );
}

function previewColumns() {
  return [
    {
      key: "name",
      header: "Account",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => (
        <div>
          <div className="text-[13px]">{row.accountName}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{row.accountNumber}</div>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => row.ownerLabel,
    },
    {
      key: "type",
      header: "Type",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => row.accountTypeLabel,
    },
    {
      key: "balance",
      header: "Balance",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => (
        <span className="type-finance">{florin(row.currentBalance)}</span>
      ),
    },
    {
      key: "credit",
      header: "Interest credit",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => (
        <span className="type-finance font-medium">{florin(row.interestCredit)}</span>
      ),
    },
    {
      key: "projected",
      header: "New balance",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => (
        <span className="type-finance">{florin(row.projectedBalance)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row: ManualInterestPreviewResult["accounts"][number]) => row.statusLabel,
    },
  ];
}

function skippedColumns() {
  return [
    ...previewColumns().slice(0, 4),
    {
      key: "reason",
      header: "Skip reason",
      cell: (row: ManualInterestPreviewResult["skippedAccounts"][number]) => (
        <span className="text-[12px] text-muted-foreground">{row.skipReason ?? "—"}</span>
      ),
    },
  ];
}
