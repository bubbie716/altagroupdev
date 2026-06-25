"use client";

import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import type { AccountInterestOpsSummary } from "@/lib/bank/account-interest.functions";
import {
  accrueAccountInterest,
  accrueAllDueAccountInterest,
  previewAccountInterest,
} from "@/lib/bank/account-interest.functions";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";

export function InternalAccountInterestOps({ summary }: { summary: AccountInterestOpsSummary }) {
  const router = useRouter();
  const previewFn = useServerFn(previewAccountInterest);
  const accrueOneFn = useServerFn(accrueAccountInterest);
  const accrueAllFn = useServerFn(accrueAllDueAccountInterest);

  const [previewAccountId, setPreviewAccountId] = useState(summary.dueAccounts[0]?.accountId ?? "");
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [pending, setPending] = useState<"preview" | "one" | "all" | null>(null);

  async function handlePreview() {
    if (!previewAccountId.trim()) return;
    setPending("preview");
    setPreviewResult(null);
    try {
      const preview = await previewFn({ data: previewAccountId.trim() });
      setPreviewResult(
        preview.eligible
          ? `Estimated interest: ${florin(preview.estimatedInterest)} at ${preview.rateLabel} on balance ${florin(preview.balance)}.`
          : `Not eligible: ${preview.ineligibleReason ?? "Unknown reason"}.`,
      );
    } catch {
      setPreviewResult("Preview failed.");
    } finally {
      setPending(null);
    }
  }

  async function handleAccrueOne(accountId: string) {
    if (
      !window.confirm(
        "Credit monthly interest for this account? This creates an INTEREST_CREDIT transaction and updates the balance.",
      )
    ) {
      return;
    }
    setPending("one");
    setActionResult(null);
    try {
      const result = await accrueOneFn({ data: { accountId } });
      if (result.status === "processed") {
        setActionResult(
          `Credited ${florin(result.interestAmount ?? 0)} (${result.referenceCode ?? result.transactionId}).`,
        );
      } else {
        setActionResult(`${result.status}: ${result.reason ?? "No details"}.`);
      }
      await router.invalidate();
    } catch {
      setActionResult("Accrual failed — admin access required.");
    } finally {
      setPending(null);
    }
  }

  async function handleAccrueAll() {
    if (
      !window.confirm(
        `Accrue interest for all ${summary.dueAccountCount} due account(s)? Estimated total: ${florin(summary.estimatedTotalInterestDue)}.`,
      )
    ) {
      return;
    }
    setPending("all");
    setActionResult(null);
    try {
      const batch = await accrueAllFn();
      setActionResult(
        `Processed ${batch.processedCount}, skipped ${batch.skippedCount}, failed ${batch.failedCount}. Total credited: ${florin(batch.totalInterestCredited)}.`,
      );
      await router.invalidate();
    } catch {
      setActionResult("Batch accrual failed — admin access required.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Due for interest" value={String(summary.dueAccountCount)} alert={summary.dueAccountCount > 0} />
        <InternalStatCard label="Interest-bearing (active)" value={String(summary.interestBearingActiveCount)} />
        <InternalStatCard
          label="Est. interest due"
          value={florin(summary.estimatedTotalInterestDue)}
          sub="If accrued now"
        />
        <InternalStatCard
          label="Credited this month"
          value={florin(summary.totalInterestCreditedThisMonth)}
          sub={
            summary.lastInterestRunAt
              ? `Last run ${new Date(summary.lastInterestRunAt).toLocaleString()}`
              : "No runs yet"
          }
        />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-1/40 p-4">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Preview account
          </label>
          <select
            value={previewAccountId}
            onChange={(e) => setPreviewAccountId(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="">Select account…</option>
            {summary.dueAccounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountNumber} — {a.accountName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={pending !== null || !previewAccountId}
          onClick={() => void handlePreview()}
          className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending === "preview" ? "Previewing…" : "Preview interest"}
        </button>
        <button
          type="button"
          disabled={pending !== null || summary.dueAccountCount === 0}
          onClick={() => void handleAccrueAll()}
          className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending === "all" ? "Accruing…" : "Accrue all due interest"}
        </button>
      </div>

      {(previewResult || actionResult) && (
        <p className="text-[13px] text-muted-foreground">{previewResult ?? actionResult}</p>
      )}

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Manual accrual only — no scheduled automation. Operators may preview; admins must run accrual.
      </p>

      {summary.dueAccounts.length > 0 ? (
        <AdminDataTable
          columns={[
            {
              key: "account",
              header: "Account",
              cell: (a) => (
                <Link
                  to="/internal/bank/accounts/$accountId"
                  params={{ accountId: a.accountId }}
                  className="font-mono text-[12px] hover:underline"
                >
                  {a.accountNumber}
                  <span className="mt-0.5 block text-muted-foreground">{a.accountName}</span>
                </Link>
              ),
            },
            { key: "holder", header: "Holder", cell: (a) => a.holder },
            { key: "balance", header: "Balance", cell: (a) => florin(a.balance), className: "text-right" },
            { key: "rate", header: "Rate", cell: (a) => a.rateLabel },
            {
              key: "due",
              header: "Due date",
              cell: (a) => new Date(a.nextInterestAccrualAt).toLocaleDateString(),
            },
            {
              key: "est",
              header: "Est. credit",
              cell: (a) => florin(a.estimatedInterest),
              className: "text-right",
            },
            {
              key: "actions",
              header: "",
              cell: (a) => (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => void handleAccrueOne(a.accountId)}
                  className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider disabled:opacity-50"
                >
                  Accrue
                </button>
              ),
            },
          ]}
          rows={summary.dueAccounts}
          rowKey={(a) => a.accountId}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
          No accounts are currently due for interest accrual.
        </p>
      )}
    </div>
  );
}
