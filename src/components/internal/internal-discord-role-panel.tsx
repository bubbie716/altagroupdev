"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  fetchDiscordRoleReconciliation,
  reconcileDiscordProductRole,
  retryDiscordRoleSyncOutbox,
} from "@/lib/internal/discord-role-sync.functions";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import type { DiscordProductRoleKey } from "@/lib/discord/discord-product-role";

type Snapshot = Awaited<ReturnType<typeof fetchDiscordRoleReconciliation>>;
type RoleRow = NonNullable<Snapshot>["roles"][number];

function outboxStateLabel(role: RoleRow): string {
  const status = role.outbox.status;
  if (!status) return "no outbox row";
  if (status === "PENDING" || status === "PROCESSING") return `pending (${status})`;
  if (status === "FAILED") return "failed";
  if (status === "DEAD") return "dead-letter";
  if (status === "SENT") return "sent";
  return status;
}

function liveRoleLabel(role: RoleRow): string {
  if (!role.liveRoleStateAvailable) {
    return role.liveRoleStateReason === "live_member_roles_not_fetched"
      ? "live member roles unavailable (not fetched)"
      : "live member roles unavailable";
  }
  return role.liveHasRole ? "has role on Discord" : "missing on Discord";
}

export function InternalDiscordRolePanel({ userId }: { userId: string }) {
  const load = useServerFn(fetchDiscordRoleReconciliation);
  const reconcile = useServerFn(reconcileDiscordProductRole);
  const retryOutbox = useServerFn(retryDiscordRoleSyncOutbox);
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  const [snapshot, setSnapshot] = useState<Snapshot>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void load({ data: userId })
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Discord roles");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, load]);

  async function runReconcile(productRole: DiscordProductRoleKey) {
    if (uiLab) return;
    const reason = window.prompt("Reason for Discord role reconcile (required)");
    if (!reason?.trim()) return;
    if (!window.confirm(`Reconcile ${productRole} for this user?`)) return;

    setBusy(`reconcile:${productRole}`);
    setError(null);
    try {
      const result = await reconcile({
        data: { userId, productRole, reason: reason.trim(), confirm: true },
      });
      setSnapshot(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconcile failed");
    } finally {
      setBusy(null);
    }
  }

  async function runRetry(role: RoleRow) {
    if (uiLab || !role.outbox.outboxId) return;
    const reason = window.prompt("Reason for retrying failed role sync (required)");
    if (!reason?.trim()) return;
    if (!window.confirm(`Retry ${role.productRole} outbox delivery?`)) return;

    setBusy(`retry:${role.productRole}`);
    setError(null);
    try {
      const result = await retryOutbox({
        data: {
          userId,
          productRole: role.productRole,
          outboxId: role.outbox.outboxId,
          reason: reason.trim(),
          confirm: true,
        },
      });
      setSnapshot(result.snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  if (!snapshot) {
    return (
      <section className="space-y-2 text-sm text-muted-foreground">
        <h3 className="text-base font-medium text-foreground">Discord roles</h3>
        <p>{error ?? "Loading Discord role state…"}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-medium text-foreground">Discord roles</h3>
        <p className="text-sm text-muted-foreground">
          Identity: {snapshot.discordUsername ?? "—"}{" "}
          {snapshot.discordId ? `(${snapshot.discordId})` : "(unlinked)"}
        </p>
        <p className="text-xs text-muted-foreground">
          Role sync {snapshot.roleSyncEnabled ? "enabled" : "disabled"}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ul className="space-y-2">
        {snapshot.roles.map((role) => {
          const canRetry =
            Boolean(role.outbox.outboxId) &&
            (role.outbox.status === "FAILED" || role.outbox.status === "DEAD");
          return (
            <li
              key={role.productRole}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">{role.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Owner bot: {role.ownerBot} · Configured: {role.configured ? "yes" : "no"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Eligibility: {role.eligibilityLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Live Discord: {liveRoleLabel(role)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Outbox: {outboxStateLabel(role)}
                    {role.outbox.retryCount != null ? ` · retries ${role.outbox.retryCount}` : ""}
                  </p>
                  {role.lastFailureReason ? (
                    <p className="text-xs text-destructive">
                      Last failure: {role.lastFailureReason}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Last attempt: {role.lastSyncAttemptAt ?? role.outbox.lastAttemptAt ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last success: {role.lastSyncSuccessAt ?? "—"}
                    {role.lastSyncFailureAt ? ` · Last fail: ${role.lastSyncFailureAt}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Audit: {role.lastAuditAction ?? "—"}
                    {role.lastAuditReason ? ` · ${role.lastAuditReason}` : ""}
                    {role.lastAuditAt ? ` · ${role.lastAuditAt}` : ""}
                  </p>
                  {role.outbox.outboxId ? (
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Outbox {role.outbox.outboxId}
                      {role.outbox.idempotencyKey
                        ? ` · ${role.outbox.idempotencyKey.slice(0, 48)}…`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                    disabled={uiLab || !role.configured || busy === `reconcile:${role.productRole}`}
                    title={uiLab ? unavailableLabel : "Reconcile against eligibility"}
                    onClick={() => void runReconcile(role.productRole)}
                  >
                    {busy === `reconcile:${role.productRole}` ? "Working…" : "Reconcile"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                    disabled={
                      uiLab || !canRetry || busy === `retry:${role.productRole}`
                    }
                    title={
                      uiLab
                        ? unavailableLabel
                        : canRetry
                          ? "Requeue failed/dead role sync"
                          : "No failed outbox row"
                    }
                    onClick={() => void runRetry(role)}
                  >
                    {busy === `retry:${role.productRole}` ? "Working…" : "Retry failed sync"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
