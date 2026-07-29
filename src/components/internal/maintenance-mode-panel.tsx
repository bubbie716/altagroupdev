"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  MAINTENANCE_SCOPE_DESCRIPTIONS,
  MAINTENANCE_SCOPE_LABELS,
  type MaintenanceModeSettings,
  type MaintenanceScope,
} from "@/lib/platform/maintenance-types";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { setMaintenanceModeOps } from "@/lib/platform/platform-settings.functions";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { cn } from "@/lib/utils";

export function MaintenanceModePanel({
  initial,
  visibleScopes,
}: {
  initial: MaintenanceModeSettings;
  visibleScopes: MaintenanceScope[];
}) {
  const router = useRouter();
  const saveFn = useServerFn(setMaintenanceModeOps);
  const { uiLab, unavailableLabel, bannerCopy } = useUiLabMutationGate();
  const [message, setMessage] = useState(initial.message);
  const [confirmAction, setConfirmAction] = useState<null | { scope: MaintenanceScope; enabled: boolean }>(
    null,
  );
  const [savingMessage, setSavingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopes = visibleScopes.filter((scope, index, all) => all.indexOf(scope) === index);
  const visibleActiveScopes = scopes.filter((scope) => initial.scopes[scope]);
  const panelActive = visibleActiveScopes.length > 0;

  const orderedScopes = useMemo(() => {
    const active = scopes.filter((s) => initial.scopes[s]);
    const inactive = scopes.filter((s) => !initial.scopes[s]);
    return [...active, ...inactive];
  }, [scopes, initial.scopes]);

  const [selectedScope, setSelectedScope] = useState<MaintenanceScope>(
    orderedScopes[0] ?? "sitewide",
  );

  useEffect(() => {
    setMessage(initial.message);
  }, [initial.message]);

  useEffect(() => {
    if (!orderedScopes.includes(selectedScope) && orderedScopes[0]) {
      setSelectedScope(orderedScopes[0]);
    }
  }, [orderedScopes, selectedScope]);

  async function refreshSettings() {
    await router.invalidate();
  }

  async function saveMessageOnly() {
    if (!initial.canEdit || uiLab) return;
    setSavingMessage(true);
    setError(null);
    try {
      const scopeForMessage = visibleActiveScopes[0] ?? selectedScope;
      await saveFn({
        data: {
          scope: scopeForMessage,
          enabled: initial.scopes[scopeForMessage],
          message,
          reason: "Updated maintenance message from internal settings",
        },
      });
      await refreshSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Save failed.");
    } finally {
      setSavingMessage(false);
    }
  }

  const selectedActive = initial.scopes[selectedScope];
  const selectedStartedAt = initial.scopeStartedAt[selectedScope];

  return (
    <Card className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Maintenance Mode</div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Select a scope to review impact and enable or disable maintenance. Active scopes appear first.
          </p>
        </div>
        <StatusBadge status={panelActive ? "Active" : "Inactive"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetaRow
          label="Active scopes"
          value={
            panelActive
              ? visibleActiveScopes.map((scope) => MAINTENANCE_SCOPE_LABELS[scope]).join(", ")
              : "None"
          }
        />
        <MetaRow label="Last updated by" value={initial.updatedByUsername ?? "—"} />
        <MetaRow
          label="Last updated"
          value={initial.updatedAt ? formatActivityDateTime(initial.updatedAt) : "—"}
        />
      </div>

      {scopes.length > 1 ? (
        <div className="mt-6">
          <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Scope
          </label>
          <select
            className="mt-2 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value as MaintenanceScope)}
            aria-label="Maintenance scope"
          >
            {orderedScopes.map((scope) => (
              <option key={scope} value={scope}>
                {MAINTENANCE_SCOPE_LABELS[scope]}
                {initial.scopes[scope] ? " · Active" : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div
        className={cn(
          "mt-4 rounded-md border px-4 py-4",
          selectedActive ? "border-amber-400/30 bg-amber-400/[0.05]" : "border-border/60 bg-surface-1/20",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
              {MAINTENANCE_SCOPE_LABELS[selectedScope]}
            </div>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
              {MAINTENANCE_SCOPE_DESCRIPTIONS[selectedScope]}
            </p>
            {selectedStartedAt ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Started {formatActivityDateTime(selectedStartedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={selectedActive ? "Active" : "Inactive"} />
            {initial.canEdit ? (
              selectedActive ? (
                <button
                  type="button"
                  className="rounded border border-destructive/30 bg-destructive/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uiLab}
                  onClick={() => {
                    if (uiLab) return;
                    setConfirmAction({ scope: selectedScope, enabled: false });
                  }}
                >
                  {uiLab ? unavailableLabel("Disable") : "Disable"}
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded border border-gold/30 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uiLab}
                  onClick={() => {
                    if (uiLab) return;
                    setConfirmAction({ scope: selectedScope, enabled: true });
                  }}
                >
                  {uiLab ? unavailableLabel("Enable") : "Enable"}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>

      {uiLab && initial.canEdit ? (
        <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-muted-foreground">
          {bannerCopy}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <label className="block text-[13px]">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Public message
          </span>
          <textarea
            className="mt-2 min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!initial.canEdit}
            placeholder="Alta is temporarily offline while scheduled maintenance is performed."
          />
        </label>

        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}

        {initial.canEdit ? (
          <button
            type="button"
            className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void saveMessageOnly()}
            disabled={savingMessage || uiLab}
          >
            {uiLab
              ? unavailableLabel("Save message")
              : savingMessage
                ? SUBMITTING_COPY.saving
                : "Save message"}
          </button>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Only admins can change maintenance mode. Operators can view current status.
          </p>
        )}
      </div>

      <OpsConfirmDialog
        open={confirmAction?.enabled === true}
        title={
          confirmAction
            ? `Enable ${MAINTENANCE_SCOPE_LABELS[confirmAction.scope].toLowerCase()}`
            : "Enable maintenance"
        }
        description={
          confirmAction
            ? `Normal users affected by ${MAINTENANCE_SCOPE_LABELS[confirmAction.scope].toLowerCase()} will be redirected to the maintenance page.`
            : ""
        }
        confirmLabel="Enable maintenance"
        variant="danger"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          if (!confirmAction) return;
          await saveFn({
            data: { scope: confirmAction.scope, enabled: true, message, reason },
          });
          await refreshSettings();
        }}
      />

      <OpsConfirmDialog
        open={confirmAction?.enabled === false}
        title={
          confirmAction
            ? `Disable ${MAINTENANCE_SCOPE_LABELS[confirmAction.scope].toLowerCase()}`
            : "Disable maintenance"
        }
        description="Affected users will regain access once this maintenance scope is turned off."
        confirmLabel="Disable maintenance"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          if (!confirmAction) return;
          await saveFn({
            data: { scope: confirmAction.scope, enabled: false, message, reason },
          });
          await refreshSettings();
        }}
      />
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[13px] text-foreground">{value}</div>
    </div>
  );
}
