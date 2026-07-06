"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { MaintenanceModeSettings } from "@/lib/platform/maintenance-types";
import { setMaintenanceModeOps } from "@/lib/platform/platform-settings.functions";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";

export function MaintenanceModePanel({ initial }: { initial: MaintenanceModeSettings }) {
  const router = useRouter();
  const saveFn = useServerFn(setMaintenanceModeOps);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [confirmAction, setConfirmAction] = useState<null | "enable" | "disable">(null);
  const [savingMessage, setSavingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(initial.enabled);
    setMessage(initial.message);
  }, [initial.enabled, initial.message]);

  async function refreshSettings() {
    await router.invalidate();
  }

  async function saveMessageOnly() {
    if (!initial.canEdit) return;
    setSavingMessage(true);
    setError(null);
    try {
      await saveFn({
        data: {
          enabled,
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

  return (
    <Card className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Maintenance Mode</div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Place the public Alta platform into maintenance mode. Normal users will see the maintenance page
            instead of bank, exchange, and profile routes.
          </p>
        </div>
        <StatusBadge status={enabled ? "Active" : "Inactive"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetaRow label="Current status" value={enabled ? "Maintenance active" : "Platform online"} />
        <MetaRow
          label="Started"
          value={initial.startedAt ? formatActivityDateTime(initial.startedAt) : "—"}
        />
        <MetaRow label="Last updated by" value={initial.updatedByUsername ?? "—"} />
        <MetaRow
          label="Last updated"
          value={initial.updatedAt ? formatActivityDateTime(initial.updatedAt) : "—"}
        />
      </div>

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

        <div className="flex flex-wrap gap-2">
          {initial.canEdit ? (
            <>
              <button
                type="button"
                className="rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                onClick={() => void saveMessageOnly()}
                disabled={savingMessage}
              >
                {savingMessage ? SUBMITTING_COPY.saving : "Save message"}
              </button>
              {!enabled ? (
                <button
                  type="button"
                  className="rounded border border-gold/30 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                  onClick={() => setConfirmAction("enable")}
                >
                  Enable maintenance
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded border border-destructive/30 bg-destructive/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive"
                  onClick={() => setConfirmAction("disable")}
                >
                  Disable maintenance
                </button>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Only admins can change maintenance mode. Operators can view current status.
            </p>
          )}
        </div>
      </div>

      <OpsConfirmDialog
        open={confirmAction === "enable"}
        title="Enable maintenance mode"
        description="You are about to place the Alta platform into maintenance mode. Normal users will be unable to access platform pages."
        confirmLabel="Enable maintenance"
        variant="danger"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          await saveFn({ data: { enabled: true, message, reason } });
          setEnabled(true);
          await refreshSettings();
        }}
      />

      <OpsConfirmDialog
        open={confirmAction === "disable"}
        title="Disable maintenance mode"
        description="Public platform access will resume for all users once maintenance mode is turned off."
        confirmLabel="Disable maintenance"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          await saveFn({ data: { enabled: false, message, reason } });
          setEnabled(false);
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
