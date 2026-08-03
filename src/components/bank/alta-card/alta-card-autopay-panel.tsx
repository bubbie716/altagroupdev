"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { florin } from "@/lib/bank/api";
import {
  fetchAltaCardAutopayContext,
  updateAltaCardAutopaySettings,
} from "@/lib/bank/alta-card-autopay.functions";
import type {
  AltaCardAutopayContext,
  AltaCardAutopayTypeCode,
} from "@/lib/bank/alta-card-autopay-types";
import {
  altaCardAutopayStatusLabel,
  altaCardAutopayTypeLabel,
} from "@/lib/bank/alta-card-autopay-types";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { SkeletonFormPanel } from "@/components/ui/skeleton-form-panel";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { BankActionProcessing } from "@/components/bank/actions/bank-action-chrome";
import { BankProcessError, BankProcessResult } from "@/components/bank/actions/bank-process-ui";
import { BANK_PROCESS_MOTION, waitBankProcessMin } from "@/lib/bank/bank-process";
import { applyUiLabAltaCardAutopay, getUiLabAltaCardOverlay } from "@/lib/bank/ui-lab-alta-card-state";
import {
  mockBankActionSubmission,
  shouldUseBankActionUiLabMock,
} from "@/lib/bank/bank-action-ui-lab";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { cn } from "@/lib/utils";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

type AutopayView = "form" | "submitting" | "success" | "error";

function parseServerError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Could not update autopay";
  if (message.startsWith("BAD_REQUEST:")) return message.slice("BAD_REQUEST:".length);
  if (message === "FORBIDDEN") return "You do not have permission to manage autopay for this card.";
  return message;
}

type AutopaySnapshot = {
  enabled: boolean;
  sourceAccountId: string;
  type: AltaCardAutopayTypeCode;
  fixedAmount: string;
};

export function AltaCardAutopayPanel({
  card,
  initialContext,
  onDirtyChange,
  onPhaseChange,
}: {
  card: AltaCardRow;
  initialContext?: AltaCardAutopayContext;
  onDirtyChange?: (dirty: boolean) => void;
  onPhaseChange?: (phase: BankActionPhase) => void;
}) {
  const router = useRouter();
  const loadContext = useServerFn(fetchAltaCardAutopayContext);
  const save = useServerFn(updateAltaCardAutopaySettings);

  const overlay = getUiLabAltaCardOverlay(card.id);
  const initialEnabled =
    overlay?.autopayEnabled ?? initialContext?.settings.enabled ?? false;

  const [context, setContext] = useState<AltaCardAutopayContext | null>(initialContext ?? null);
  const [loading, setLoading] = useState(!initialContext && !shouldUseBankActionUiLabMock());
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sourceAccountId, setSourceAccountId] = useState(
    initialContext?.settings.sourceAccountId ?? initialContext?.sourceAccounts[0]?.id ?? "",
  );
  const [type, setType] = useState<AltaCardAutopayTypeCode>(
    initialContext?.settings.type ?? "minimum_payment",
  );
  const [fixedAmount, setFixedAmount] = useState(
    String(initialContext?.settings.fixedAmount ?? "100"),
  );
  const [view, setView] = useState<AutopayView>("form");
  const [error, setError] = useState<string | null>(null);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const submittingLockRef = useRef(false);

  const initialSnapshotRef = useRef<AutopaySnapshot>({
    enabled: initialEnabled,
    sourceAccountId:
      initialContext?.settings.sourceAccountId ?? initialContext?.sourceAccounts[0]?.id ?? "",
    type: initialContext?.settings.type ?? "minimum_payment",
    fixedAmount: String(initialContext?.settings.fixedAmount ?? "100"),
  });

  useEffect(() => {
    if (shouldUseBankActionUiLabMock() && !context) {
      setContext({
        settings: {
          enabled: initialEnabled,
          sourceAccountId: "ui-lab-checking",
          sourceAccountLabel: "UI Lab Checking · AB-5000-000001",
          type: "minimum_payment",
          fixedAmount: null,
          lastRunAt: null,
          lastStatus: "not_run",
          failureReason: null,
          canManage: true,
        },
        sourceAccounts: [
          {
            id: "ui-lab-checking",
            accountName: "UI Lab Checking",
            accountNumber: "AB-5000-000001",
            availableBalance: 12_000,
          },
        ],
      });
      setSourceAccountId("ui-lab-checking");
      setLoading(false);
      initialSnapshotRef.current = {
        enabled: initialEnabled,
        sourceAccountId: "ui-lab-checking",
        type: "minimum_payment",
        fixedAmount: "100",
      };
    }
  }, [context, initialEnabled]);

  const dirty =
    enabled !== initialSnapshotRef.current.enabled ||
    sourceAccountId !== initialSnapshotRef.current.sourceAccountId ||
    type !== initialSnapshotRef.current.type ||
    (type === "fixed_amount" && fixedAmount !== initialSnapshotRef.current.fixedAmount);

  useEffect(() => {
    onDirtyChange?.(dirty && view === "form");
  }, [dirty, view, onDirtyChange]);

  useEffect(() => {
    if (view === "submitting") onPhaseChange?.("submitting");
    else if (view === "success") onPhaseChange?.("success");
    else if (view === "error") onPhaseChange?.("error");
    else if (confirmEnable) onPhaseChange?.("review");
    else onPhaseChange?.("details");
  }, [view, confirmEnable, onPhaseChange]);

  async function ensureContext() {
    if (context) return context;
    if (shouldUseBankActionUiLabMock()) {
      const mock: AltaCardAutopayContext = {
        settings: {
          enabled: initialEnabled,
          sourceAccountId: "ui-lab-checking",
          sourceAccountLabel: "UI Lab Checking · AB-5000-000001",
          type: "minimum_payment",
          fixedAmount: null,
          lastRunAt: null,
          lastStatus: "not_run",
          failureReason: null,
          canManage: true,
        },
        sourceAccounts: [
          {
            id: "ui-lab-checking",
            accountName: "UI Lab Checking",
            accountNumber: "AB-5000-000001",
            availableBalance: 12_000,
          },
        ],
      };
      setContext(mock);
      return mock;
    }
    setLoading(true);
    try {
      const loaded = await loadContext({ data: card.id });
      setContext(loaded);
      setEnabled(overlay?.autopayEnabled ?? loaded.settings.enabled);
      setSourceAccountId(loaded.settings.sourceAccountId ?? loaded.sourceAccounts[0]?.id ?? "");
      setType(loaded.settings.type ?? "minimum_payment");
      setFixedAmount(String(loaded.settings.fixedAmount ?? "100"));
      initialSnapshotRef.current = {
        enabled: overlay?.autopayEnabled ?? loaded.settings.enabled,
        sourceAccountId: loaded.settings.sourceAccountId ?? loaded.sourceAccounts[0]?.id ?? "",
        type: loaded.settings.type ?? "minimum_payment",
        fixedAmount: String(loaded.settings.fixedAmount ?? "100"),
      };
      return loaded;
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (enabled && !confirmEnable) {
      setConfirmEnable(true);
      return;
    }

    if (submittingLockRef.current || view === "submitting") return;
    submittingLockRef.current = true;
    setView("submitting");
    onDirtyChange?.(false);
    const startedAt = Date.now();

    try {
      await ensureContext();

      if (shouldUseBankActionUiLabMock()) {
        mockBankActionSubmission({ kind: "autopay", amount: 0 });
        applyUiLabAltaCardAutopay(card.id, enabled);
        setContext((current) =>
          current
            ? {
                ...current,
                settings: {
                  ...current.settings,
                  enabled,
                  sourceAccountId: enabled ? sourceAccountId : null,
                  type: enabled ? type : null,
                  fixedAmount: enabled && type === "fixed_amount" ? Number(fixedAmount) : null,
                },
              }
            : current,
        );
      } else {
        const updated = await save({
          data: {
            cardId: card.id,
            enabled,
            sourceAccountId: enabled ? sourceAccountId : undefined,
            type: enabled ? type : undefined,
            fixedAmount: enabled && type === "fixed_amount" ? Number(fixedAmount) : undefined,
          },
        });
        if (isUiLabMode()) {
          applyUiLabAltaCardAutopay(card.id, enabled);
        }
        setContext((current) =>
          current
            ? { ...current, settings: updated }
            : { settings: updated, sourceAccounts: [] },
        );
        await refreshMutationRouteData(router, "alta-card");
      }

      initialSnapshotRef.current = {
        enabled,
        sourceAccountId,
        type,
        fixedAmount,
      };
      setConfirmEnable(false);
      await waitBankProcessMin(startedAt, BANK_PROCESS_MOTION.minProcessingMs);
      setView("success");
    } catch (err) {
      setError(parseServerError(err));
      setView("error");
    } finally {
      submittingLockRef.current = false;
    }
  }

  if (loading && !context) {
    return <SkeletonFormPanel fields={4} label={LOADING_COPY.autopay} />;
  }

  const settings = context?.settings;
  const sourceAccounts = context?.sourceAccounts ?? [];
  const readOnly = settings ? !settings.canManage : false;
  const disabled = card.status === "closed" || readOnly || view === "submitting";

  if (sourceAccounts.length === 0 && !readOnly) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Open an active Alta Bank account to enable automatic card payments.
      </p>
    );
  }

  if (view === "submitting") {
    return <BankActionProcessing label="Saving Autopay…" />;
  }

  if (view === "success") {
    return (
      <BankProcessResult
        kind="success"
        title="Autopay saved"
        liveMessage={enabled ? "Autopay is enabled." : "Autopay is disabled."}
        summary={[
          { label: "Status", value: enabled ? "Enabled" : "Disabled" },
          ...(enabled
            ? [
                {
                  label: "Payment type",
                  value: altaCardAutopayTypeLabel(type),
                },
              ]
            : []),
        ]}
        onDone={() => {
          setView("form");
          onPhaseChange?.("details");
        }}
      />
    );
  }

  if (view === "error") {
    return (
      <BankProcessError
        title="Could not save Autopay"
        message={error ?? "Your Autopay settings could not be saved."}
        onRetry={() => {
          setError(null);
          setView("form");
        }}
        retryLabel="Try again"
      />
    );
  }

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[13px]">
        <div>
          <dt className={fieldLabel}>Status</dt>
          <dd className="mt-1">{enabled ? "Enabled" : "Disabled"}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Payment type</dt>
          <dd className="mt-1">{altaCardAutopayTypeLabel(settings?.type ?? null)}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Source account</dt>
          <dd className="mt-1">{settings?.sourceAccountLabel ?? "—"}</dd>
        </div>
        {settings?.type === "fixed_amount" ? (
          <div>
            <dt className={fieldLabel}>Fixed amount</dt>
            <dd className="mt-1 font-mono tabular-nums">{florin(settings.fixedAmount ?? 0)}</dd>
          </div>
        ) : null}
        <div>
          <dt className={fieldLabel}>Last run</dt>
          <dd className="mt-1">
            {settings?.lastRunAt ? formatActivityDateTime(settings.lastRunAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className={fieldLabel}>Last status</dt>
          <dd className="mt-1">{altaCardAutopayStatusLabel(settings?.lastStatus ?? "not_run")}</dd>
        </div>
      </dl>

      {settings?.failureReason ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          Last failure: {settings.failureReason}
        </p>
      ) : null}

      {readOnly ? (
        <p className="text-[13px] text-muted-foreground">
          Autopay is managed on the company business card. Contact a treasury manager to make changes.
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <label className="flex items-start gap-3 text-[13px]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setConfirmEnable(false);
              }}
              disabled={disabled}
              className="mt-0.5 size-4 rounded border-border"
            />
            <span>Enable automatic payments on your payment due date</span>
          </label>

          {enabled ? (
            <>
              <label className="block space-y-2">
                <span className={fieldLabel}>Payment source account</span>
                <select
                  value={sourceAccountId}
                  onChange={(e) => {
                    setSourceAccountId(e.target.value);
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px]"
                >
                  {sourceAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} · {account.accountNumber} · {florin(account.availableBalance)}{" "}
                      avail.
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["minimum_payment", "Minimum payment"],
                    ["statement_balance", "Statement balance"],
                    ["fixed_amount", "Fixed amount"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setType(value);
                    }}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-[12px]",
                      type === value ? "border-gold/50 bg-gold/5" : "border-border",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {type === "fixed_amount" ? (
                <label className="block space-y-2">
                  <span className={fieldLabel}>Fixed payment amount</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={fixedAmount}
                    onChange={(e) => {
                      setFixedAmount(e.target.value);
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[14px]"
                  />
                </label>
              ) : null}

              {confirmEnable ? (
                <p className="rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-[13px] leading-relaxed">
                  You are enabling automatic payments for your Alta Card. Payments will be attempted on
                  your payment due date.
                </p>
              ) : null}
            </>
          ) : null}

          <button
            type="submit"
            disabled={disabled}
            className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
          >
            {confirmEnable ? "Confirm and save autopay" : "Save autopay"}
          </button>
        </form>
      )}
    </div>
  );
}

export function AltaCardAutopayReadOnlySummary({
  settings,
  title = "Company autopay",
}: {
  settings: import("@/lib/bank/alta-card-autopay-types").AltaCardAutopaySettings;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 p-4 space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <dl className="grid gap-3 sm:grid-cols-2 text-[13px]">
        <div>
          <dt className={fieldLabel}>Status</dt>
          <dd className="mt-1">{settings.enabled ? "Enabled" : "Disabled"}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Payment type</dt>
          <dd className="mt-1">{altaCardAutopayTypeLabel(settings.type)}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Last status</dt>
          <dd className="mt-1">{altaCardAutopayStatusLabel(settings.lastStatus)}</dd>
        </div>
        {settings.failureReason ? (
          <div className="sm:col-span-2">
            <dt className={fieldLabel}>Last failure</dt>
            <dd className="mt-1 text-destructive">{settings.failureReason}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
