"use client";

import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import type { AccountInterestOpsSummary } from "@/lib/bank/account-interest.functions";
import {
  accrueAccountInterest,
  accrueAllDueAccountInterest,
  previewAccountInterest,
} from "@/lib/bank/account-interest.functions";
import { OpsAction } from "@/components/internal/ops-action";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

/** Accrual / preview actions only — account attention lists live on the Interest page. */
export function InternalAccountInterestOps({
  summary,
  mode = "full",
}: {
  summary: AccountInterestOpsSummary;
  /** `actions` omits duplicated status cards and due-account tables. */
  mode?: "full" | "actions";
}) {
  useRouterState({
    select: (s) => readDevSiteFromSearch(s.location.search as Record<string, unknown>),
  });
  const router = useRouter();
  const previewFn = useServerFn(previewAccountInterest);
  const accrueOneFn = useServerFn(accrueAccountInterest);
  const accrueAllFn = useServerFn(accrueAllDueAccountInterest);
  const { uiLab, unavailableLabel, bannerCopy } = useUiLabMutationGate();

  const [previewAccountId, setPreviewAccountId] = useState(summary.dueAccounts[0]?.accountId ?? "");
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [pending, setPending] = useState<"preview" | "one" | "all" | null>(null);

  async function handlePreview() {
    if (uiLab || !previewAccountId.trim()) return;
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

  async function handleAccrueOne(accountId: string, _reason: string) {
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
      await refreshMutationRouteData(router, "bank");
    } catch {
      setActionResult("Accrual failed — admin access required.");
    } finally {
      setPending(null);
    }
  }

  async function handleAccrueAll(_reason: string) {
    setPending("all");
    setActionResult(null);
    try {
      const batch = await accrueAllFn();
      setActionResult(
        `Processed ${batch.processedCount}, skipped ${batch.skippedCount}, failed ${batch.failedCount}. Total credited: ${florin(batch.totalInterestCredited)}.`,
      );
      await refreshMutationRouteData(router, "bank");
    } catch {
      setActionResult("Batch accrual failed — admin access required.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {uiLab ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-muted-foreground">
          {bannerCopy} Manual interest accrual and preview are disabled in UI Lab.
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-1/40 p-4">
        <div className="min-w-[12rem] flex-1">
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Preview account
          </label>
          <select
            value={previewAccountId}
            onChange={(e) => setPreviewAccountId(e.target.value)}
            disabled={uiLab}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Select account…</option>
            {summary.dueAccounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountNumber} — {a.holder}
              </option>
            ))}
          </select>
        </div>
        {uiLab ? (
          <button
            type="button"
            disabled
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-muted-foreground disabled:opacity-60"
          >
            {unavailableLabel("Preview")}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending !== null || !previewAccountId}
            onClick={() => void handlePreview()}
            className="rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending === "preview" ? SUBMITTING_COPY.previewing : "Preview accrual"}
          </button>
        )}
        {!uiLab ? (
          <OpsAction
            label={pending === "all" ? SUBMITTING_COPY.accruing : "Accrue all due"}
            variant="primary"
            title="Accrue all due interest"
            description="Credits monthly interest for every due account. Distinct from manual category credits."
            impact={`${summary.dueAccountCount} account(s) · est. ${florin(summary.estimatedTotalInterestDue)}`}
            disabled={pending !== null || summary.dueAccountCount === 0}
            onConfirm={handleAccrueAll}
          />
        ) : null}
      </div>

      {!uiLab && summary.dueAccounts.length > 0 && mode === "actions" ? (
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Accrue one account
          </div>
          <ul className="space-y-2">
            {summary.dueAccounts.map((a) => (
              <li
                key={a.accountId}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-3 py-2"
              >
                <div className="text-[13px]">
                  <span className="font-medium">{a.holder}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {a.accountNumber} · est. {florin(a.estimatedInterest)}
                  </span>
                </div>
                <OpsAction
                  label="Accrue"
                  title="Credit monthly interest"
                  description="Creates an INTEREST_CREDIT transaction for this account."
                  impact={florin(a.estimatedInterest)}
                  disabled={pending !== null}
                  onConfirm={async (reason) => {
                    await handleAccrueOne(a.accountId, reason);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(previewResult || actionResult) && (
        <p className="text-[13px] text-muted-foreground">{previewResult ?? actionResult}</p>
      )}

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Automated accrual is distinct from manual category credits. Do not invent rates here.
      </p>
    </div>
  );
}
