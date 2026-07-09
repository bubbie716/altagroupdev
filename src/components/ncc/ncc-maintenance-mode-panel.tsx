"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { NccCard } from "@/components/ncc/ncc-ui";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { NccMaintenanceModeSettings } from "@/lib/ncc/ncc-maintenance-types";
import { setNccMaintenanceModeOps } from "@/lib/ncc/ncc-maintenance.functions";
import { cn } from "@/lib/utils";

export function NccMaintenanceModePanel({ initial }: { initial: NccMaintenanceModeSettings }) {
  const router = useRouter();
  const saveFn = useServerFn(setNccMaintenanceModeOps);
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
          reason: "Updated NCC maintenance message from admin panel",
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
    <NccCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            NCC Maintenance Mode
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Place the Newport Clearing Corporation public site into maintenance mode. Institution
            sign-in and this admin panel remain available to authorized operators.
          </p>
        </div>
        <StatusPill active={enabled} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetaRow label="Current status" value={enabled ? "Maintenance active" : "Network online"} />
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
        <label className="block text-[14px]">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Public message
          </span>
          <textarea
            className="mt-2 min-h-[96px] w-full rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[14px] text-[#111827]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={!initial.canEdit}
            placeholder="Newport Clearing Corporation is temporarily offline while scheduled maintenance is performed."
          />
        </label>

        {error ? <p className="text-[13px] text-[#b91c1c]">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {initial.canEdit ? (
            <>
              <button
                type="button"
                className="rounded-sm border border-[#e5e7eb] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#374151]"
                onClick={() => void saveMessageOnly()}
                disabled={savingMessage}
              >
                {savingMessage ? "Saving…" : "Save message"}
              </button>
              {!enabled ? (
                <button
                  type="button"
                  className="rounded-sm border border-[#0c4d32]/30 bg-[#e8f2ed] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#0c4d32]"
                  onClick={() => setConfirmAction("enable")}
                >
                  Enable maintenance
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-sm border border-[#fecaca] bg-[#fef2f2] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[#b91c1c]"
                  onClick={() => setConfirmAction("disable")}
                >
                  Disable maintenance
                </button>
              )}
            </>
          ) : (
            <p className="text-[13px] text-[#6b7280]">
              Only Alta admins can change NCC maintenance mode. Operators can view current status.
            </p>
          )}
        </div>
      </div>

      {confirmAction === "enable" ? (
        <ConfirmDialog
          title="Enable NCC maintenance mode"
          description="Public NCC pages will show the maintenance screen for normal visitors."
          confirmLabel="Enable maintenance"
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            await saveFn({
              data: {
                enabled: true,
                message,
                reason: "Enabled NCC maintenance mode from admin panel",
              },
            });
            setEnabled(true);
            setConfirmAction(null);
            await refreshSettings();
          }}
        />
      ) : null}

      {confirmAction === "disable" ? (
        <ConfirmDialog
          title="Disable NCC maintenance mode"
          description="Public access to the NCC site will resume for all users."
          confirmLabel="Disable maintenance"
          danger={false}
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            await saveFn({
              data: {
                enabled: false,
                message,
                reason: "Disabled NCC maintenance mode from admin panel",
              },
            });
            setEnabled(false);
            setConfirmAction(null);
            await refreshSettings();
          }}
        />
      ) : null}
    </NccCard>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-sm px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
        active ? "bg-[#fef3c7] text-[#92400e]" : "bg-[#e8f2ed] text-[#0c4d32]",
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-[#e5e7eb] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">{label}</div>
      <div className="mt-2 text-[14px] text-[#111827]">{value}</div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger = true,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#111827]/40 p-4">
      <div className="w-full max-w-md rounded-sm border border-[#e5e7eb] bg-white p-5 shadow-lg">
        <h2 className="text-[16px] font-semibold text-[#111827]">{title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-sm border border-[#e5e7eb] px-3 py-1.5 text-[12px] font-medium text-[#374151]"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(
              "rounded-sm px-3 py-1.5 text-[12px] font-medium",
              danger
                ? "border border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
                : "border border-[#0c4d32]/30 bg-[#e8f2ed] text-[#0c4d32]",
            )}
            disabled={pending}
            onClick={() => {
              setPending(true);
              void onConfirm().finally(() => setPending(false));
            }}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
