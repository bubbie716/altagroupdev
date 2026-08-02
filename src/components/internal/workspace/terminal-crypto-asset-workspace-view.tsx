"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { StatusBadge } from "@/components/internal/status-badge";
import {
  RecordActionGroup,
  RecordActionsSheet,
} from "@/components/internal/workspace/record-actions-sheet";
import {
  RecordAttentionBanner,
  RecordEmptyCopy,
  RecordMoreSection,
  RecordSummaryCard,
  type RecordWorkspaceTab,
} from "@/components/internal/workspace/record-workspace-layout";
import { RecordWorkspacePage } from "@/components/internal/workspace/record-workspace-page";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { workspaceBreadcrumbs } from "@/components/internal/workspace/workspace-page";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import {
  recordSectionId,
  toRecordWorkspaceSearchParams,
  type RecordActivityFilter,
  type RecordWorkspaceSearch,
} from "@/lib/internal/record-workspace-search";
import {
  formatCryptoMoney,
  formatCryptoPrice,
} from "@/lib/terminal/crypto/crypto-format";
import type { CryptoOpsAssetWorkspace } from "@/lib/terminal/crypto/crypto-ops-read.service";
import type { CryptoOpsActorCapabilities } from "@/lib/terminal/crypto/crypto-ops.functions";
import type { ActivationReadinessResult } from "@/lib/terminal/crypto/crypto-activation-readiness.service";
import {
  cryptoOpsKindLabel,
  cryptoOpsSeverityLabel,
  cryptoOpsStatusLabel,
  newCryptoOpsIdempotencyKey,
} from "@/lib/terminal/crypto/crypto-ops-ui";
import {
  recordCryptoContributionFn,
  reopenCryptoReconIssueFn,
  resolveCryptoReconIssueFn,
  runCryptoReconciliationFn,
  sweepCryptoRevenueFn,
  transitionCryptoAssetStatusFn,
  updateCryptoFeeConfigFn,
} from "@/lib/terminal/crypto/crypto-ops.functions";
import { cn } from "@/lib/utils";

const ACTIVITY_FILTERS = ["all", "status", "orders", "fees", "operator"] as const;
type CryptoActivityFilter = (typeof ACTIVITY_FILTERS)[number];

const ACTIVITY_FILTER_LABELS: Record<CryptoActivityFilter, string> = {
  all: "All",
  status: "Status",
  orders: "Trades",
  fees: "Money moves",
  operator: "Operator",
};

type ProcessPhase = "idle" | "review" | "processing" | "success" | "error";

function money(value: string): string {
  return formatCryptoMoney(value);
}

function price(value: string, symbol?: string): string {
  return formatCryptoPrice(value, symbol);
}

function matchesActivityFilter(
  kind: CryptoOpsAssetWorkspace["activity"][number]["kind"],
  filter: CryptoActivityFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "status") return kind === "status";
  if (filter === "orders") return kind === "settlement";
  if (filter === "fees") return kind === "sweep" || kind === "contribution";
  if (filter === "operator") return kind === "reconciliation" || kind === "operator";
  return true;
}

type ActionFormState = {
  reason: string;
  confirmed: boolean;
  amount: string;
  typedSymbol: string;
  totalFeeBps: string;
  revenueFeeBps: string;
  stabilizationFeeBps: string;
};

const emptyForm = (workspace?: CryptoOpsAssetWorkspace): ActionFormState => ({
  reason: "",
  confirmed: false,
  amount: "",
  typedSymbol: "",
  totalFeeBps: workspace ? String(workspace.totalFeeBps) : "",
  revenueFeeBps: workspace ? String(workspace.revenueFeeBps) : "",
  stabilizationFeeBps: workspace ? String(workspace.stabilizationFeeBps) : "",
});

export function TerminalCryptoAssetWorkspaceView({
  workspace,
  readiness,
  capabilities,
  search,
}: {
  workspace: CryptoOpsAssetWorkspace;
  readiness: ActivationReadinessResult | null;
  capabilities: CryptoOpsActorCapabilities;
  search: RecordWorkspaceSearch;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processPhase, setProcessPhase] = useState<ProcessPhase>("idle");
  const [form, setForm] = useState<ActionFormState>(() => emptyForm(workspace));
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [issueActionId, setIssueActionId] = useState<string | null>(null);

  const statusLabel = cryptoOpsStatusLabel(workspace.status);
  const actionableIssues = workspace.openIssues.filter(
    (i) => i.severity === "CRITICAL" || i.severity === "WARNING",
  );
  const attention = [
    ...actionableIssues.map((i) => ({
      id: i.id,
      label: cryptoOpsSeverityLabel(i.severity),
      detail: i.summary,
    })),
    ...(workspace.status === "HALTED"
      ? [{ id: "halted", label: "Trading halted", detail: "New buys and sells are blocked." }]
      : []),
    ...(workspace.status === "REDEMPTION_ONLY"
      ? [
          {
            id: "redemption",
            label: "Redemption only",
            detail: "Purchases are blocked. Legitimate sells remain available.",
          },
        ]
      : []),
  ];

  const activityFilter = (search.filter as CryptoActivityFilter | undefined) ?? "all";
  const filteredActivity = useMemo(
    () => workspace.activity.filter((e) => matchesActivityFilter(e.kind, activityFilter)),
    [workspace.activity, activityFilter],
  );

  /** Prefer ops-safe sensitivity copy already loaded on the workspace (no Prisma client import). */
  const impactLabel = workspace.sensitivityLabel;

  async function runAction(
    run: () => Promise<{ ok: boolean; message?: string; code?: string; successDetail?: string }>,
  ) {
    if (capabilities.uiLab || pending) return;
    setPending(true);
    setProcessPhase("processing");
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await run();
      if (!result.ok) {
        setActionError(result.message ?? "Action failed");
        setProcessPhase("error");
        return;
      }
      setActionSuccess(result.successDetail ?? "Action completed.");
      setProcessPhase("success");
      setForm(emptyForm(workspace));
      setActiveAction(null);
      setIssueActionId(null);
      await router.invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
      setProcessPhase("error");
    } finally {
      setPending(false);
    }
  }

  function ActionConfirmFields({
    showAmount,
    showTypedSymbol,
  }: {
    showAmount?: boolean;
    showTypedSymbol?: boolean;
  }) {
    return (
      <div className="mt-2 space-y-2 rounded border border-border/60 bg-surface-1/40 p-2.5">
        {showTypedSymbol ? (
          <label className="block text-[11px] text-muted-foreground">
            Type {workspace.symbol} to confirm
            <input
              className="mt-1 h-11 w-full rounded border border-border bg-background px-3 text-[13px]"
              value={form.typedSymbol}
              onChange={(e) => setForm((f) => ({ ...f, typedSymbol: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ) : null}
        {showAmount ? (
          <label className="block text-[11px] text-muted-foreground">
            Amount (florins)
            <input
              className="mt-1 h-11 w-full rounded border border-border bg-background px-3 text-[13px] tabular-nums"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              inputMode="decimal"
              placeholder="0.00"
            />
          </label>
        ) : null}
        <label className="block text-[11px] text-muted-foreground">
          Reason
          <textarea
            className="mt-1 min-h-[72px] w-full rounded border border-border bg-background px-3 py-2 text-[13px]"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            placeholder="Operator reason (required)"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-[12px]">
          <input
            type="checkbox"
            checked={form.confirmed}
            onChange={(e) => setForm((f) => ({ ...f, confirmed: e.target.checked }))}
          />
          I confirm this operational action
        </label>
      </div>
    );
  }

  function ActionButton({
    id,
    label,
    tone = "default",
    disabled,
    disabledReason,
    onPick,
  }: {
    id: string;
    label: string;
    tone?: "default" | "danger";
    disabled?: boolean;
    disabledReason?: string;
    onPick: () => void;
  }) {
    const open = activeAction === id;
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          disabled={disabled || pending}
          className={cn(
            "flex min-h-11 w-full items-center rounded border px-3 py-2 text-left text-[13px] disabled:opacity-50",
            tone === "danger"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border hover:border-border-strong",
          )}
          onClick={() => {
            setActiveAction(open ? null : id);
            setActionError(null);
            onPick();
          }}
        >
          {label}
        </button>
        {disabled && disabledReason ? (
          <p className="text-[11px] text-muted-foreground">{disabledReason}</p>
        ) : null}
      </div>
    );
  }

  const headerActions = (
    <RecordActionsSheet
      title={`${workspace.symbol} actions`}
      description={`${workspace.displayName} · ${statusLabel}`}
      disabled={false}
    >
      {capabilities.uiLab ? (
        <p className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-100">
          UI Lab demonstration — all crypto market mutations are disabled. No financial writes,
          activations, reserve moves, or reconciliation writes.
        </p>
      ) : null}

      {processPhase === "processing" ? (
        <p className="rounded border border-border/60 bg-surface-1/50 px-3 py-2 text-[12px]">
          Processing… do not resubmit.
        </p>
      ) : null}
      {processPhase === "success" && actionSuccess ? (
        <p className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-900 dark:text-emerald-100">
          {actionSuccess}
        </p>
      ) : null}

      <RecordActionGroup title="Trading controls">
        <ActionButton
          id="halt"
          label="Halt trading"
          tone="danger"
          disabled={
            capabilities.uiLab ||
            !capabilities.canHalt ||
            (workspace.status !== "ACTIVE" && workspace.status !== "REDEMPTION_ONLY")
          }
          disabledReason={
            capabilities.uiLab
              ? "Disabled in UI Lab"
              : workspace.status !== "ACTIVE" && workspace.status !== "REDEMPTION_ONLY"
                ? "Available from Active or Redemption only"
                : undefined
          }
          onPick={() => undefined}
        />
        {activeAction === "halt" && !capabilities.uiLab ? (
          <>
            <ActionConfirmFields />
            <button
              type="button"
              disabled={pending}
              className="min-h-11 w-full rounded border border-destructive/40 bg-destructive/10 text-[13px] text-destructive disabled:opacity-50"
              onClick={() =>
                void runAction(async () => {
                  const res = await transitionCryptoAssetStatusFn({
                    data: {
                      symbol: workspace.symbol,
                      toStatus: "HALTED",
                      reason: form.reason,
                      confirmed: form.confirmed,
                      idempotencyKey: newCryptoOpsIdempotencyKey("halt"),
                      expectedStatus: workspace.status as never,
                      expectedVersion: workspace.version,
                    },
                  });
                  return res.ok ? { ok: true } : { ok: false, message: res.message, code: res.code };
                })
              }
            >
              Confirm halt
            </button>
          </>
        ) : null}

        <ActionButton
          id="redemption"
          label="Redemption only"
          disabled={
            capabilities.uiLab ||
            !capabilities.canHalt ||
            (workspace.status !== "ACTIVE" && workspace.status !== "HALTED")
          }
          disabledReason={
            capabilities.uiLab
              ? "Disabled in UI Lab"
              : workspace.status !== "ACTIVE" && workspace.status !== "HALTED"
                ? "Available from Active or Halted"
                : undefined
          }
          onPick={() => undefined}
        />
        {activeAction === "redemption" && !capabilities.uiLab ? (
          <>
            <ActionConfirmFields />
            <button
              type="button"
              disabled={pending}
              className="min-h-11 w-full rounded border border-border text-[13px] disabled:opacity-50"
              onClick={() =>
                void runAction(async () => {
                  const res = await transitionCryptoAssetStatusFn({
                    data: {
                      symbol: workspace.symbol,
                      toStatus: "REDEMPTION_ONLY",
                      reason: form.reason,
                      confirmed: form.confirmed,
                      idempotencyKey: newCryptoOpsIdempotencyKey("redeem-only"),
                      expectedStatus: workspace.status as never,
                      expectedVersion: workspace.version,
                    },
                  });
                  return res.ok ? { ok: true } : { ok: false, message: res.message, code: res.code };
                })
              }
            >
              Confirm redemption-only
            </button>
          </>
        ) : null}
      </RecordActionGroup>

      <RecordActionGroup title="Corporate lifecycle">
        {workspace.status === "DRAFT" ||
        workspace.status === "HALTED" ||
        workspace.status === "REDEMPTION_ONLY" ? (
          <>
            <ActionButton
              id="activate"
              label={workspace.status === "DRAFT" ? "Activate" : "Resume to Active"}
              disabled={capabilities.uiLab || !capabilities.canActivate}
              disabledReason={
                capabilities.uiLab
                  ? "Disabled in UI Lab"
                  : !capabilities.canActivate
                    ? "Corporate admin only"
                    : undefined
              }
              onPick={() => undefined}
            />
            {activeAction === "activate" && !capabilities.uiLab && capabilities.canActivate ? (
              <>
                {readiness ? (
                  <ul className="space-y-1 rounded border border-border/60 p-2.5 text-[12px]">
                    {readiness.items.map((item) => (
                      <li key={item.key} className="flex gap-2">
                        <span className={item.passed ? "text-emerald-700" : "text-destructive"}>
                          {item.passed ? "Pass" : "Fail"}
                        </span>
                        <span>
                          <span className="font-medium">{item.label}</span>
                          <span className="block text-muted-foreground">{item.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <ActionConfirmFields showTypedSymbol />
                <button
                  type="button"
                  disabled={pending || readiness?.allPassed === false}
                  className="min-h-11 w-full rounded border border-gold/40 bg-gold/10 text-[13px] disabled:opacity-50"
                  onClick={() =>
                    void runAction(async () => {
                      const res = await transitionCryptoAssetStatusFn({
                        data: {
                          symbol: workspace.symbol,
                          toStatus: "ACTIVE",
                          reason: form.reason,
                          confirmed: form.confirmed,
                          idempotencyKey: newCryptoOpsIdempotencyKey("activate"),
                          expectedStatus: workspace.status as never,
                          expectedVersion: workspace.version,
                          typedSymbol: form.typedSymbol,
                        },
                      });
                      return res.ok
                        ? { ok: true }
                        : { ok: false, message: res.message, code: res.code };
                    })
                  }
                >
                  Confirm activate / resume
                </button>
              </>
            ) : null}
          </>
        ) : null}

        {(workspace.status === "DRAFT" || workspace.status === "REDEMPTION_ONLY") && (
          <>
            <ActionButton
              id="close"
              label="Close asset"
              tone="danger"
              disabled={capabilities.uiLab || !capabilities.canActivate}
              disabledReason={
                capabilities.uiLab
                  ? "Disabled in UI Lab"
                  : !capabilities.canActivate
                    ? "Corporate admin only"
                    : undefined
              }
              onPick={() => undefined}
            />
            {activeAction === "close" && !capabilities.uiLab && capabilities.canActivate ? (
              <>
                <ActionConfirmFields showTypedSymbol />
                <button
                  type="button"
                  disabled={pending}
                  className="min-h-11 w-full rounded border border-destructive/40 bg-destructive/10 text-[13px] text-destructive disabled:opacity-50"
                  onClick={() =>
                    void runAction(async () => {
                      const res = await transitionCryptoAssetStatusFn({
                        data: {
                          symbol: workspace.symbol,
                          toStatus: "CLOSED",
                          reason: form.reason,
                          confirmed: form.confirmed,
                          idempotencyKey: newCryptoOpsIdempotencyKey("close"),
                          expectedStatus: workspace.status as never,
                          expectedVersion: workspace.version,
                          typedSymbol: form.typedSymbol,
                        },
                      });
                      return res.ok
                        ? { ok: true }
                        : { ok: false, message: res.message, code: res.code };
                    })
                  }
                >
                  Confirm close
                </button>
              </>
            ) : null}
          </>
        )}
      </RecordActionGroup>

      <RecordActionGroup title="Integrity & money">
        <ActionButton
          id="recon"
          label="Run reconciliation"
          disabled={capabilities.uiLab || !capabilities.canReconcile}
          disabledReason={capabilities.uiLab ? "Disabled in UI Lab" : undefined}
          onPick={() => undefined}
        />
        {activeAction === "recon" && !capabilities.uiLab ? (
          <>
            <ActionConfirmFields />
            <button
              type="button"
              disabled={pending}
              className="min-h-11 w-full rounded border border-border text-[13px] disabled:opacity-50"
              onClick={() =>
                void runAction(async () => {
                  const res = await runCryptoReconciliationFn({
                    data: {
                      reason: form.reason,
                      confirmed: form.confirmed,
                      idempotencyKey: newCryptoOpsIdempotencyKey("recon"),
                      symbol: workspace.symbol,
                    },
                  });
                  return res.ok ? { ok: true } : { ok: false, message: res.message, code: res.code };
                })
              }
            >
              Confirm reconciliation
            </button>
          </>
        ) : null}

        <ActionButton
          id="sweep"
          label="Sweep revenue"
          disabled={
            capabilities.uiLab ||
            !capabilities.canSweep ||
            !workspace.revenueSweepConfigured
          }
          disabledReason={
            capabilities.uiLab
              ? "Disabled in UI Lab"
              : !capabilities.canSweep
                ? "Corporate admin only"
                : !workspace.revenueSweepConfigured
                  ? "Set TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID to enable sweeps"
                  : undefined
          }
          onPick={() => undefined}
        />
        {activeAction === "sweep" &&
        !capabilities.uiLab &&
        capabilities.canSweep &&
        workspace.revenueSweepConfigured ? (
          <>
            <div className="rounded border border-border/60 bg-surface-1/40 p-2.5 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground/90">Review summary</p>
              <p className="mt-1">Accrued revenue before: {money(workspace.accruedRevenue)}</p>
              <p>
                After (if amount valid):{" "}
                {form.amount.trim()
                  ? money(
                      String(
                        Math.max(
                          0,
                          Number(workspace.accruedRevenue) - Number(form.amount || "0"),
                        ).toFixed(2),
                      ),
                    )
                  : "—"}
              </p>
              <p className="mt-1">Does not touch protected reserve, stabilization, or wallets.</p>
            </div>
            <ActionConfirmFields showAmount />
            <button
              type="button"
              disabled={pending}
              className="min-h-11 w-full rounded border border-border text-[13px] disabled:opacity-50"
              onClick={() =>
                void runAction(async () => {
                  const res = await sweepCryptoRevenueFn({
                    data: {
                      symbol: workspace.symbol,
                      amount: form.amount,
                      reason: form.reason,
                      confirmed: form.confirmed,
                      idempotencyKey: newCryptoOpsIdempotencyKey("sweep"),
                      expectedMarketStateVersion: workspace.marketStateVersion,
                    },
                  });
                  return res.ok
                    ? {
                        ok: true,
                        successDetail: res.result.replayed
                          ? "Idempotent replay — sweep already recorded."
                          : `Swept ${money(res.result.amount)}. Revenue after ${money(res.result.accruedRevenueAfter)}.`,
                      }
                    : { ok: false, message: res.message, code: res.code };
                })
              }
            >
              Confirm sweep
            </button>
          </>
        ) : null}

        {(
          [
            ["contrib-reserve", "PROTECTED_RESERVE", "External protected contribution"],
            ["contrib-stab", "STABILIZATION_FUND", "Stabilization contribution"],
            ["contrib-rev", "REVENUE_TO_STABILIZATION", "Revenue → stabilization"],
          ] as const
        ).map(([id, kind, label]) => (
          <div key={id} className="space-y-1.5">
            <ActionButton
              id={id}
              label={label}
              disabled={capabilities.uiLab || !capabilities.canContribute}
              disabledReason={
                capabilities.uiLab
                  ? "Disabled in UI Lab"
                  : !capabilities.canContribute
                    ? "Corporate admin only"
                    : undefined
              }
              onPick={() => undefined}
            />
            {activeAction === id && !capabilities.uiLab && capabilities.canContribute ? (
              <>
                <div className="rounded border border-border/60 bg-surface-1/40 p-2.5 text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground/90">Review summary</p>
                  {kind === "PROTECTED_RESERVE" ? (
                    <p className="mt-1">
                      Protected reserve before: {money(workspace.protectedReserve)} → after +amount
                    </p>
                  ) : null}
                  {kind === "STABILIZATION_FUND" ? (
                    <p className="mt-1">
                      Stabilization before: {money(workspace.stabilizationFund)} → after +amount
                    </p>
                  ) : null}
                  {kind === "REVENUE_TO_STABILIZATION" ? (
                    <>
                      <p className="mt-1">Revenue before: {money(workspace.accruedRevenue)}</p>
                      <p>Stabilization before: {money(workspace.stabilizationFund)}</p>
                    </>
                  ) : null}
                  <p className="mt-1">Append-only ledger entry. No customer minting.</p>
                </div>
                <ActionConfirmFields showAmount />
                <button
                  type="button"
                  disabled={pending}
                  className="min-h-11 w-full rounded border border-border text-[13px] disabled:opacity-50"
                  onClick={() =>
                    void runAction(async () => {
                      const res = await recordCryptoContributionFn({
                        data: {
                          symbol: workspace.symbol,
                          kind,
                          amount: form.amount,
                          reason: form.reason,
                          confirmed: form.confirmed,
                          idempotencyKey: newCryptoOpsIdempotencyKey(id),
                          expectedMarketStateVersion: workspace.marketStateVersion,
                        },
                      });
                      return res.ok
                        ? {
                            ok: true,
                            successDetail: res.result.replayed
                              ? "Idempotent replay — contribution already recorded."
                              : `${label} recorded for ${money(res.result.amount)}.`,
                          }
                        : { ok: false, message: res.message, code: res.code };
                    })
                  }
                >
                  Confirm {label.toLowerCase()}
                </button>
              </>
            ) : null}
          </div>
        ))}
      </RecordActionGroup>

      <RecordActionGroup title="Fees (future orders)">
        <ActionButton
          id="fees"
          label="Update fee configuration"
          disabled={capabilities.uiLab || !capabilities.canConfigureFees}
          disabledReason={
            capabilities.uiLab
              ? "Disabled in UI Lab"
              : !capabilities.canConfigureFees
                ? "Corporate admin only"
                : undefined
          }
          onPick={() => {
            setForm((f) => ({
              ...f,
              totalFeeBps: String(workspace.totalFeeBps),
              revenueFeeBps: String(workspace.revenueFeeBps),
              stabilizationFeeBps: String(workspace.stabilizationFeeBps),
            }));
            setProcessPhase("review");
          }}
        />
        {activeAction === "fees" && !capabilities.uiLab && capabilities.canConfigureFees ? (
          <>
            <div className="rounded border border-border/60 bg-surface-1/40 p-2.5 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground/90">Review summary</p>
              <p className="mt-1">
                Current: {workspace.totalFeeBps} bps (rev {workspace.revenueFeeBps} / stab{" "}
                {workspace.stabilizationFeeBps})
              </p>
              <p>
                Proposed: {form.totalFeeBps || "—"} bps (rev {form.revenueFeeBps || "—"} / stab{" "}
                {form.stabilizationFeeBps || "—"})
              </p>
              <p className="mt-1">Effective immediately for future orders only. Historical fills unchanged.</p>
            </div>
            <div className="space-y-2 rounded border border-border/60 bg-surface-1/40 p-2.5">
              <label className="block text-[11px] text-muted-foreground">
                Total fee (bps)
                <input
                  className="mt-1 h-11 w-full rounded border border-border bg-background px-3 text-[13px] tabular-nums"
                  value={form.totalFeeBps}
                  onChange={(e) => setForm((f) => ({ ...f, totalFeeBps: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Revenue fee (bps)
                <input
                  className="mt-1 h-11 w-full rounded border border-border bg-background px-3 text-[13px] tabular-nums"
                  value={form.revenueFeeBps}
                  onChange={(e) => setForm((f) => ({ ...f, revenueFeeBps: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground">
                Stabilization fee (bps)
                <input
                  className="mt-1 h-11 w-full rounded border border-border bg-background px-3 text-[13px] tabular-nums"
                  value={form.stabilizationFeeBps}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, stabilizationFeeBps: e.target.value }))
                  }
                  inputMode="numeric"
                />
              </label>
            </div>
            <ActionConfirmFields />
            <button
              type="button"
              disabled={pending}
              className="min-h-11 w-full rounded border border-border text-[13px] disabled:opacity-50"
              onClick={() =>
                void runAction(async () => {
                  const res = await updateCryptoFeeConfigFn({
                    data: {
                      symbol: workspace.symbol,
                      totalFeeBps: Number(form.totalFeeBps),
                      revenueFeeBps: Number(form.revenueFeeBps),
                      stabilizationFeeBps: Number(form.stabilizationFeeBps),
                      reason: form.reason,
                      confirmed: form.confirmed,
                      idempotencyKey: newCryptoOpsIdempotencyKey("fees"),
                      expectedAssetVersion: workspace.version,
                    },
                  });
                  return res.ok
                    ? {
                        ok: true,
                        successDetail: res.result.replayed
                          ? "Idempotent replay — fee config already applied."
                          : `Fee config v${res.result.configVersion} effective for future orders.`,
                      }
                    : { ok: false, message: res.message, code: res.code };
                })
              }
            >
              Confirm fee update
            </button>
          </>
        ) : null}
      </RecordActionGroup>

      {actionError ? (
        <p className="text-[12px] text-destructive">{actionError.replace(/^BAD_REQUEST:/, "")}</p>
      ) : null}
    </RecordActionsSheet>
  );

  const overview: RecordWorkspaceTab = {
    id: "overview",
    label: "Overview",
    content: (
      <div className="space-y-3">
        {attention.length > 0 ? <RecordAttentionBanner items={attention} /> : null}

        <RecordSummaryCard title="Market" id={recordSectionId("summary")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Symbol">
              <span className="font-mono font-medium">{workspace.symbol}</span>
            </WorkspaceField>
            <WorkspaceField label="Name">{workspace.displayName}</WorkspaceField>
            <WorkspaceField label="Status">
              <StatusBadge status={statusLabel} />
            </WorkspaceField>
            <WorkspaceField label="Kind">{cryptoOpsKindLabel(workspace.kind)}</WorkspaceField>
            <WorkspaceField label="Price">
              <span className="tabular-nums">{price(workspace.currentPrice, workspace.symbol)}</span>
            </WorkspaceField>
            <WorkspaceField label="Capabilities">
              {workspace.tradingCapabilities.canBuy && workspace.tradingCapabilities.canSell
                ? "Buy and sell"
                : workspace.tradingCapabilities.canSell
                  ? "Sell / redeem only"
                  : "Trading unavailable"}
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Supply & reserves" id={recordSectionId("reserves")}>
          <WorkspaceFieldGrid columns={3}>
            <WorkspaceField label="Circulating">
              <span className="tabular-nums font-mono text-[12px]">{workspace.circulatingSupply}</span>
            </WorkspaceField>
            <WorkspaceField label="Treasury">
              <span className="tabular-nums font-mono text-[12px]">{workspace.treasuryInventory}</span>
            </WorkspaceField>
            <WorkspaceField label="Protected reserve">
              <span className="tabular-nums">{money(workspace.protectedReserve)}</span>
            </WorkspaceField>
            <WorkspaceField label="Required liability">
              <span className="tabular-nums">{money(workspace.requiredLiability)}</span>
            </WorkspaceField>
            <WorkspaceField label="Coverage">
              <span className="tabular-nums">
                {workspace.reserveCoveragePercent != null
                  ? `${workspace.reserveCoveragePercent}%`
                  : "—"}
              </span>
            </WorkspaceField>
            <WorkspaceField label="Stabilization">
              <span className="tabular-nums">{money(workspace.stabilizationFund)}</span>
            </WorkspaceField>
            <WorkspaceField label="Accrued revenue">
              <span className="tabular-nums">{money(workspace.accruedRevenue)}</span>
            </WorkspaceField>
            <WorkspaceField label="Wallets with balance">
              <span className="tabular-nums">{workspace.walletCount}</span>
            </WorkspaceField>
            <WorkspaceField label="Lifetime florin volume">
              <span className="tabular-nums">{money(workspace.volumeFlorins)}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordSummaryCard>

        <RecordSummaryCard title="Integrity" id={recordSectionId("integrity")}>
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Open critical issues">
              <span className="tabular-nums">{workspace.openCriticalIssues}</span>
            </WorkspaceField>
            <WorkspaceField label="Open warnings">
              <span className="tabular-nums">{workspace.openWarningIssues}</span>
            </WorkspaceField>
            <WorkspaceField label="Last trade">
              {workspace.lastTradeAt
                ? formatActivityDateTime(workspace.lastTradeAt)
                : "No trades yet"}
            </WorkspaceField>
            <WorkspaceField label="Last reconciliation">
              {workspace.lastReconciliationAt
                ? `${formatActivityDateTime(workspace.lastReconciliationAt)}${
                    workspace.lastReconciliationStatus
                      ? ` · ${workspace.lastReconciliationStatus}`
                      : ""
                  }`
                : "Not run yet"}
            </WorkspaceField>
          </WorkspaceFieldGrid>

          {actionableIssues.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {actionableIssues.map((issue) => (
                <li key={issue.id} className="rounded border border-border/60 px-3 py-2.5 text-[12px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {cryptoOpsSeverityLabel(issue.severity)} · {issue.checkKey}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {issue.status}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{issue.summary}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Fingerprint {issue.fingerprint.slice(0, 16)}…
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    First seen {formatActivityDateTime(issue.firstSeenAt)} · Last seen{" "}
                    {formatActivityDateTime(issue.lastSeenAt)}
                  </p>
                  {issue.technicalDetails ? (
                    <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                      {issue.technicalDetails}
                    </p>
                  ) : null}
                  {capabilities.uiLab ? (
                    <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">
                      Resolve disabled in UI Lab
                    </p>
                  ) : capabilities.canResolveIssues ? (
                    <div className="mt-2 space-y-2">
                      <button
                        type="button"
                        className="min-h-11 rounded border border-border px-3 text-[12px]"
                        onClick={() =>
                          setIssueActionId(issueActionId === issue.id ? null : issue.id)
                        }
                      >
                        Resolve issue
                      </button>
                      {issueActionId === issue.id ? (
                        <>
                          <ActionConfirmFields />
                          <button
                            type="button"
                            disabled={pending}
                            className="min-h-11 w-full rounded border border-border text-[12px] disabled:opacity-50"
                            onClick={() =>
                              void runAction(async () => {
                                const res = await resolveCryptoReconIssueFn({
                                  data: {
                                    issueId: issue.id,
                                    reason: form.reason,
                                    confirmed: form.confirmed,
                                    idempotencyKey: newCryptoOpsIdempotencyKey("resolve-issue"),
                                  },
                                });
                                return res.ok
                                  ? {
                                      ok: true,
                                      successDetail: res.result.replayed
                                        ? "Idempotent replay — issue already resolved."
                                        : "Issue marked resolved. Re-run reconciliation to confirm fingerprints stay clear.",
                                    }
                                  : { ok: false, message: res.message, code: res.code };
                              })
                            }
                          >
                            Confirm resolve
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Terminal admin required to resolve
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground">
              No open critical or warning issues.
            </p>
          )}

          {workspace.recentlyResolvedIssues.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Recently resolved
              </p>
              {workspace.recentlyResolvedIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded border border-border/50 px-3 py-2 text-[12px] text-muted-foreground"
                >
                  <p className="text-foreground/90">
                    {cryptoOpsSeverityLabel(issue.severity)} · {issue.checkKey}
                  </p>
                  <p className="mt-0.5">{issue.summary}</p>
                  <p className="mt-1 font-mono text-[10px]">
                    {issue.resolutionSource ?? "resolved"}
                    {issue.resolvedAt ? ` · ${formatActivityDateTime(issue.resolvedAt)}` : ""}
                  </p>
                  {capabilities.canReopenIssues && !capabilities.uiLab ? (
                    <button
                      type="button"
                      className="mt-2 min-h-11 rounded border border-border px-3 text-[12px]"
                      disabled={pending}
                      onClick={() => {
                        setIssueActionId(`reopen-${issue.id}`);
                        setActiveAction(null);
                      }}
                    >
                      Reopen (Corporate)
                    </button>
                  ) : null}
                  {issueActionId === `reopen-${issue.id}` && capabilities.canReopenIssues ? (
                    <div className="mt-2 space-y-2">
                      <ActionConfirmFields />
                      <button
                        type="button"
                        disabled={pending}
                        className="min-h-11 w-full rounded border border-border text-[12px] disabled:opacity-50"
                        onClick={() =>
                          void runAction(async () => {
                            const res = await reopenCryptoReconIssueFn({
                              data: {
                                issueId: issue.id,
                                reason: form.reason,
                                confirmed: form.confirmed,
                                idempotencyKey: newCryptoOpsIdempotencyKey("reopen-issue"),
                              },
                            });
                            return res.ok
                              ? {
                                  ok: true,
                                  successDetail: res.result.replayed
                                    ? "Idempotent replay — issue already open."
                                    : "Issue reopened.",
                                }
                              : { ok: false, message: res.message, code: res.code };
                          })
                        }
                      >
                        Confirm reopen
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </RecordSummaryCard>
      </div>
    ),
  };

  const activity: RecordWorkspaceTab = {
    id: "activity",
    label: "Activity",
    content: (
      <div className="space-y-3" id={recordSectionId("activity")}>
        <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Activity filters">
          {ACTIVITY_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                void router.navigate({
                  to: ".",
                  search: () =>
                    toRecordWorkspaceSearchParams({
                      tab: "activity",
                      filter: id === "all" ? undefined : (id as RecordActivityFilter),
                      from: search.from,
                      site: search.site,
                    }),
                });
              }}
              className={cn(
                "min-h-11 rounded border px-3 py-1.5 text-[12px]",
                activityFilter === id
                  ? "border-gold/40 bg-gold/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-border-strong",
              )}
            >
              {ACTIVITY_FILTER_LABELS[id]}
            </button>
          ))}
        </div>
        {filteredActivity.length === 0 ? (
          <RecordEmptyCopy>No activity for this filter yet.</RecordEmptyCopy>
        ) : (
          <ol className="space-y-2">
            {filteredActivity.map((event) => (
              <li key={event.id} className="rounded border border-border/60 px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-medium">{event.title}</p>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatActivityDateTime(event.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{event.detail}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    ),
  };

  const more: RecordWorkspaceTab = {
    id: "more",
    label: "More",
    content: (
      <div className="space-y-3">
        <RecordMoreSection
          id={recordSectionId("fees")}
          title="Fees & curve"
          defaultOpen={search.section === "fees"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Total fee (current)">
              {workspace.totalFeeBps} bps
            </WorkspaceField>
            <WorkspaceField label="Revenue fee (current)">
              {workspace.revenueFeeBps} bps
            </WorkspaceField>
            <WorkspaceField label="Stabilization fee (current)">
              {workspace.stabilizationFeeBps} bps
            </WorkspaceField>
            <WorkspaceField label="Fee edits">
              {capabilities.canConfigureFees && !capabilities.uiLab
                ? "Corporate admin — Actions → Fees"
                : capabilities.uiLab
                  ? "Disabled in UI Lab"
                  : "Read-only (Corporate admin required)"}
            </WorkspaceField>
            <WorkspaceField label="Launch / peg price">
              {price(workspace.pegOrStartingPrice)}
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Read-only — migration required
              </span>
            </WorkspaceField>
            <WorkspaceField label="Current price">{price(workspace.currentPrice)}</WorkspaceField>
            <WorkspaceField label="Market-impact target">
              {impactLabel ?? workspace.sensitivityLabel ?? "—"}
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Read-only application constant
              </span>
            </WorkspaceField>
            <WorkspaceField label="Curve rate">
              <span className="break-all font-mono text-[11px]">{workspace.curveRate ?? "—"}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Read-only — use curve recalibration migration
              </span>
            </WorkspaceField>
            <WorkspaceField label="Config match">
              {workspace.matchesAuthoritativeConfig
                ? "Matches application launch config"
                : "Drift from application launch config"}
            </WorkspaceField>
            <WorkspaceField label="Max supply">
              <span className="font-mono text-[12px]">{workspace.maxSupply ?? "Variable"}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>

          {workspace.configHistory.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Configuration versions
              </p>
              <ul className="space-y-2 text-[12px]">
                {workspace.configHistory.map((row) => (
                  <li key={row.id} className="rounded border border-border/50 px-3 py-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-medium">v{row.configVersion}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {formatActivityDateTime(row.effectiveAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{row.changeSummary}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Previous {row.previousTotalFeeBps} → {row.nextTotalFeeBps} bps ·{" "}
                      {row.reason}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      Actor {row.actorUserId.slice(0, 12)}…
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-[12px] text-muted-foreground">
              No fee configuration versions recorded yet. Launch values came from migrations.
            </p>
          )}
        </RecordMoreSection>

        <RecordMoreSection
          id={recordSectionId("settlements")}
          title="Recent settlements"
          defaultOpen={search.section === "settlements"}
        >
          {workspace.recentSettlements.length === 0 ? (
            <RecordEmptyCopy>No settlements yet.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-2 text-[12px]">
              {workspace.recentSettlements.map((row) => (
                <li key={row.id} className="rounded border border-border/50 px-3 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="tabular-nums">
                      {row.executedQuantity} @ {price(row.averageExecutionPrice)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatActivityDateTime(row.executedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Gross {money(row.grossValue)} · Fee {money(row.totalFee)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </RecordMoreSection>

        <RecordMoreSection
          id={recordSectionId("ledger")}
          title="Market ledger"
          defaultOpen={search.section === "ledger"}
        >
          {workspace.recentLedger.length === 0 ? (
            <RecordEmptyCopy>No ledger entries yet.</RecordEmptyCopy>
          ) : (
            <ul className="space-y-2 text-[12px]">
              {workspace.recentLedger.map((row) => (
                <li key={row.id} className="rounded border border-border/50 px-3 py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      {row.account.replaceAll("_", " ").toLowerCase()} ·{" "}
                      {row.kind.replaceAll("_", " ").toLowerCase()}
                    </span>
                    <span className="tabular-nums">{money(row.delta)}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    After {money(row.balanceAfter)} · {formatActivityDateTime(row.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </RecordMoreSection>

        <RecordMoreSection
          id={recordSectionId("technical")}
          title="IDs & versions"
          defaultOpen={search.section === "technical"}
        >
          <WorkspaceFieldGrid columns={2}>
            <WorkspaceField label="Asset ID">
              <span className="break-all font-mono text-[11px]">{workspace.assetId}</span>
            </WorkspaceField>
            <WorkspaceField label="Lifecycle version">
              <span className="tabular-nums">{workspace.version}</span>
            </WorkspaceField>
            <WorkspaceField label="Market state version">
              <span className="tabular-nums">{workspace.marketStateVersion}</span>
            </WorkspaceField>
            <WorkspaceField label="Candles">
              <span className="tabular-nums">{workspace.candleCount}</span>
            </WorkspaceField>
          </WorkspaceFieldGrid>
        </RecordMoreSection>
      </div>
    ),
  };

  return (
    <RecordWorkspacePage
      title={workspace.symbol}
      breadcrumbs={workspaceBreadcrumbs([
        { label: "Home", to: "/internal" },
        {
          label: "System",
          to: "/internal/terminal/system",
          search: withInternalSiteSearch({}, search.site),
        },
        {
          label: "Crypto markets",
          to: "/internal/terminal/crypto",
          search: withInternalSiteSearch({}, search.site),
        },
        { label: workspace.symbol },
      ])}
      recordType="Crypto market"
      primaryId={
        <>
          {workspace.displayName} · {cryptoOpsKindLabel(workspace.kind)}
        </>
      }
      status={statusLabel}
      meta={
        <>
          <span className="tabular-nums">{price(workspace.currentPrice, workspace.symbol)}</span>
          <span>{workspace.walletCount} wallets</span>
        </>
      }
      warning={
        workspace.openCriticalIssues > 0 ||
        workspace.status === "HALTED" ||
        workspace.status === "REDEMPTION_ONLY" ? (
          <span className="text-[12px] text-amber-700 dark:text-amber-300">Needs attention</span>
        ) : null
      }
      headerActions={headerActions}
      search={search}
      tabs={[overview, activity, more]}
    />
  );
}
