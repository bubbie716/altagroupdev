"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoadingMessage } from "@/components/ui/loading-indicator";
import { LOADING_COPY } from "@/lib/ui/route-loading";
import { florin } from "@/lib/bank/api";
import {
  fetchInternalAltaCardAutopayContext,
  runAltaCardAutopayManualRecord,
  updateAltaCardAutopaySettings,
} from "@/lib/bank/alta-card-autopay.functions";
import type {
  AltaCardAutopayAuditRow,
  AltaCardAutopayContext,
  AltaCardAutopayTypeCode,
} from "@/lib/bank/alta-card-autopay-types";
import {
  altaCardAutopayStatusLabel,
  altaCardAutopayTypeLabel,
} from "@/lib/bank/alta-card-autopay-types";
import { OpsAction } from "@/components/internal/ops-action";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { cn } from "@/lib/utils";

const fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

export function InternalAltaCardAutopayPanel({
  cardId,
  initialContext,
  initialAudit,
  onRefresh,
}: {
  cardId: string;
  initialContext?: AltaCardAutopayContext;
  initialAudit?: AltaCardAutopayAuditRow[];
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const save = useServerFn(updateAltaCardAutopaySettings);
  const runManual = useServerFn(runAltaCardAutopayManualRecord);
  const reload = useServerFn(fetchInternalAltaCardAutopayContext);

  const [context, setContext] = useState(initialContext ?? null);
  const [audit, setAudit] = useState(initialAudit ?? []);
  const [enabled, setEnabled] = useState(initialContext?.settings.enabled ?? false);
  const [sourceAccountId, setSourceAccountId] = useState(
    initialContext?.settings.sourceAccountId ?? initialContext?.sourceAccounts[0]?.id ?? "",
  );
  const [type, setType] = useState<AltaCardAutopayTypeCode>(
    initialContext?.settings.type ?? "minimum_payment",
  );
  const [fixedAmount, setFixedAmount] = useState(
    String(initialContext?.settings.fixedAmount ?? "100"),
  );
  const [manualReason, setManualReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const settings = context?.settings;
  const sourceAccounts = context?.sourceAccounts ?? [];

  async function refreshLocal() {
    const loaded = await reload({ data: cardId });
    setContext(loaded.context);
    setAudit(loaded.audit);
    setEnabled(loaded.context.settings.enabled);
    setSourceAccountId(
      loaded.context.settings.sourceAccountId ?? loaded.context.sourceAccounts[0]?.id ?? "",
    );
    setType(loaded.context.settings.type ?? "minimum_payment");
    setFixedAmount(String(loaded.context.settings.fixedAmount ?? "100"));
    await onRefresh();
    await router.invalidate();
  }

  async function handleSave() {
    setError(null);
    setMessage(null);
    try {
      await save({
        data: {
          cardId,
          enabled,
          sourceAccountId: enabled ? sourceAccountId : undefined,
          type: enabled ? type : undefined,
          fixedAmount: enabled && type === "fixed_amount" ? Number(fixedAmount) : undefined,
        },
      });
      setMessage("Autopay settings saved.");
      await refreshLocal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleManualRun() {
    if (!manualReason.trim()) {
      setError("Reason is required for manual autopay run");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const result = await runManual({ data: { cardId, reason: manualReason.trim() } });
      setMessage(
        `Manual autopay ${result.status}${result.paymentReferenceCode ? ` · ${result.paymentReferenceCode}` : ""}${result.failureReason ? ` · ${result.failureReason}` : ""}`,
      );
      setManualReason("");
      await refreshLocal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Manual run failed");
    }
  }

  if (!context) {
    return <LoadingMessage>{LOADING_COPY.autopay}</LoadingMessage>;
  }

  return (
    <div className="space-y-6 rounded-xl border border-border bg-surface-1/80 p-5">
      <div>
        <h3 className="font-serif text-[18px]">Autopay</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          View or override automatic statement payments for this card.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[13px]">
        <div>
          <dt className={fieldLabel}>Enabled</dt>
          <dd className="mt-1">{settings?.enabled ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Type</dt>
          <dd className="mt-1">{altaCardAutopayTypeLabel(settings?.type ?? null)}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Source</dt>
          <dd className="mt-1">{settings?.sourceAccountLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className={fieldLabel}>Last status</dt>
          <dd className="mt-1">{altaCardAutopayStatusLabel(settings?.lastStatus ?? "not_run")}</dd>
        </div>
      </dl>

      {settings?.failureReason ? (
        <p className="text-[13px] text-destructive">Last failure: {settings.failureReason}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enable autopay
          </label>
          {enabled ? (
            <>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-[13px]"
              >
                {sourceAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName} · {account.accountNumber}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["minimum_payment", "Minimum"],
                    ["statement_balance", "Statement"],
                    ["fixed_amount", "Fixed"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={cn(
                      "rounded border px-2 py-1 text-[11px]",
                      type === value ? "border-gold/50 bg-gold/5" : "border-border",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {type === "fixed_amount" ? (
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={fixedAmount}
                  onChange={(e) => setFixedAmount(e.target.value)}
                  className="w-full rounded border border-border px-3 py-2 font-mono text-[13px]"
                />
              ) : null}
            </>
          ) : null}
          <OpsAction
            label="Save autopay settings"
            variant="primary"
            title="Save autopay settings"
            description="Updates autopay configuration for this card."
            onConfirm={async () => {
              await handleSave();
            }}
          />
        </div>

        <div className="space-y-3">
          <p className={fieldLabel}>Manual run</p>
          <input
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
            placeholder="Reason (required)"
            className="w-full rounded border border-border px-3 py-2 text-[13px]"
          />
          <OpsAction
            label="Run autopay now"
            variant="primary"
            title="Run autopay now"
            description="Triggers an immediate autopay attempt."
            impact={manualReason.trim() || "Uses reason from dialog if field empty"}
            disabled={!manualReason.trim()}
            onConfirm={async (reason) => {
              if (!manualReason.trim()) setManualReason(reason);
              await handleManualRun();
            }}
          />
        </div>
      </div>

      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      {message ? <p className="text-[13px] text-gold">{message}</p> : null}

      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Autopay audit history
        </p>
        <AdminDataTable
          columns={[
            {
              key: "when",
              header: "When",
              cell: (row: AltaCardAutopayAuditRow) => (
                <span className="font-mono text-[11px]">{row.createdAt.slice(0, 16).replace("T", " ")}</span>
              ),
            },
            { key: "action", header: "Action", cell: (row: AltaCardAutopayAuditRow) => row.action },
            { key: "actor", header: "Actor", cell: (row: AltaCardAutopayAuditRow) => row.actorUsername },
            {
              key: "amount",
              header: "Amount",
              cell: (row: AltaCardAutopayAuditRow) => {
                const amount = row.metadata?.amount;
                return typeof amount === "number" ? florin(amount) : "—";
              },
            },
            {
              key: "detail",
              header: "Detail",
              cell: (row: AltaCardAutopayAuditRow) => (
                <span className="text-[12px] text-muted-foreground">{row.description}</span>
              ),
            },
          ]}
          rows={audit}
          rowKey={(row) => row.id}
        />
      </div>
    </div>
  );
}
