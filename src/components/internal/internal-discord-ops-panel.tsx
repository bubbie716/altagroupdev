"use client";

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  fetchDiscordOpsSnapshot,
  fetchDiscordOutboxRowDetail,
  fetchDiscordRoleReconciliation,
  reconcileDiscordProductRole,
  replayDiscordOutboxRow,
  retryDiscordOutboxRow,
  retryDiscordRoleSyncOutbox,
} from "@/lib/internal/discord-ops.functions";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import type { DiscordProductRoleKey } from "@/lib/discord/discord-product-role";
import { useRouter } from "@tanstack/react-router";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

type OpsSnapshot = Awaited<ReturnType<typeof fetchDiscordOpsSnapshot>>;
type RoleSnapshot = Awaited<ReturnType<typeof fetchDiscordRoleReconciliation>>;
type RoleRow = NonNullable<RoleSnapshot>["roles"][number];
type OutboxRow = NonNullable<OpsSnapshot>["recent"][number];

function readinessLabel(state: string): string {
  if (state === "available") return "Available";
  if (state === "disabled") return "Disabled";
  if (state === "not_configured") return "Not configured";
  if (state === "blocked") return "Blocked";
  return state;
}

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

function formatAge(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * Phase 8 Discord operations entry point — readiness, outbox health, role sync.
 * Mounted on the customer workspace; mutations require admin + confirmation.
 */
export function InternalDiscordOpsPanel({ userId }: { userId: string }) {
  const router = useRouter();
  const loadOps = useServerFn(fetchDiscordOpsSnapshot);
  const loadRoles = useServerFn(fetchDiscordRoleReconciliation);
  const loadDetail = useServerFn(fetchDiscordOutboxRowDetail);
  const retryOutbox = useServerFn(retryDiscordOutboxRow);
  const replayOutbox = useServerFn(replayDiscordOutboxRow);
  const reconcile = useServerFn(reconcileDiscordProductRole);
  const retryRole = useServerFn(retryDiscordRoleSyncOutbox);
  const { uiLab, unavailableLabel } = useUiLabMutationGate();

  const [ops, setOps] = useState<OpsSnapshot | null>(null);
  const [roles, setRoles] = useState<RoleSnapshot>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const [detail, setDetail] = useState<OutboxRow | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    const [opsResult, roleResult] = await Promise.allSettled([
      loadOps(),
      loadRoles({ data: userId }),
    ]);
    if (opsResult.status === "fulfilled") {
      setOps(opsResult.value);
    } else {
      setOps(null);
      setError(opsResult.reason instanceof Error ? opsResult.reason.message : "Failed to load Discord ops");
    }
    if (roleResult.status === "fulfilled") {
      setRoles(roleResult.value);
    } else {
      setRoles(null);
      setError((current) => current ?? (roleResult.reason instanceof Error ? roleResult.reason.message : "Role sync is unavailable"));
    }
    setLoading(false);
  }, [loadOps, loadRoles, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!detail) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDetail(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail]);

  async function runRetryOutbox(row: OutboxRow) {
    if (uiLab) return;
    const reason = window.prompt("Reason for retrying Discord delivery (required)");
    if (!reason?.trim()) return;
    if (!window.confirm(`Retry ${row.eventType} → ${row.targetBot}?`)) return;
    setBusy(`retry:${row.id}`);
    try {
      const result = await retryOutbox({
        data: { outboxId: row.id, reason: reason.trim(), confirm: true },
      });
      setOps(result.snapshot);
      void refreshMutationRouteData(router, "internal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  async function runReplayOutbox(row: OutboxRow) {
    if (uiLab) return;
    const reason = window.prompt("Reason for replaying Discord delivery (required)");
    if (!reason?.trim()) return;
    if (!window.confirm(`Replay creates a new outbox row for ${row.eventType}. Continue?`)) return;
    setBusy(`replay:${row.id}`);
    try {
      const result = await replayOutbox({
        data: { outboxId: row.id, reason: reason.trim(), confirm: true },
      });
      setOps(result.snapshot);
      void refreshMutationRouteData(router, "internal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setBusy(null);
    }
  }

  async function runReconcile(productRole: DiscordProductRoleKey) {
    if (uiLab) return;
    const reason = window.prompt("Reason for Discord role reconcile (required)");
    if (!reason?.trim()) return;
    if (!window.confirm(`Reconcile ${productRole} for this user?`)) return;
    setBusy(`reconcile:${productRole}`);
    try {
      const result = await reconcile({
        data: { userId, productRole, reason: reason.trim(), confirm: true },
      });
      setRoles(result.snapshot);
      void refreshMutationRouteData(router, "internal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reconcile failed");
    } finally {
      setBusy(null);
    }
  }

  async function runRetryRole(role: RoleRow) {
    if (uiLab || !role.outbox.outboxId) return;
    const reason = window.prompt("Reason for retrying failed role sync (required)");
    if (!reason?.trim()) return;
    if (!window.confirm(`Retry ${role.productRole} outbox delivery?`)) return;
    setBusy(`retry-role:${role.productRole}`);
    try {
      const result = await retryRole({
        data: {
          userId,
          productRole: role.productRole,
          outboxId: role.outbox.outboxId,
          reason: reason.trim(),
          confirm: true,
        },
      });
      setRoles(result.snapshot);
      void refreshMutationRouteData(router, "internal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !ops) {
    return (
      <section className="space-y-2 text-sm text-muted-foreground">
        <h3 className="text-base font-medium text-foreground">Discord operations</h3>
        <p>{error ?? "Loading Discord operations…"}</p>
      </section>
    );
  }

  if (!ops) {
    return (
      <section className="space-y-2 text-sm text-muted-foreground">
        <h3 className="text-base font-medium text-foreground">Discord operations</h3>
        <p>{error ?? "Discord operations are unavailable."}</p>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs"
          onClick={() => void refresh()}
        >
          Refresh health
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-medium text-foreground">Discord operations</h3>
          <p className="text-sm text-muted-foreground">
            Bank, Secretary, and Terminal delivery health for this workspace.
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
          disabled={Boolean(busy)}
          onClick={() => void refresh().catch((err) => setError(err instanceof Error ? err.message : "Refresh failed"))}
        >
          Refresh health
        </button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {uiLab ? (
        <p className="text-xs text-muted-foreground">
          UI Lab: delivery mutations are disabled ({unavailableLabel("Discord delivery")}.)
        </p>
      ) : null}

      {/* Bot readiness */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Bots</h4>
        <ul className="grid gap-2 sm:grid-cols-3">
          {ops.readiness.bots.map((bot) => {
            const health = ops.health.byBot[bot.bot];
            return (
              <li key={bot.bot} className="rounded-md border border-border px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{bot.productLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {readinessLabel(bot.state)}
                  {bot.deliveryEnabled ? "" : " · delivery off"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pending {health.pending ?? "—"} · Processing {health.processing ?? "—"} · Sent{" "}
                  {health.sent ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Failed {health.failed ?? "—"} · Dead {health.dead ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last success: {health.lastSuccessfulDeliveryAt ?? "—"}
                </p>
                {health.lastError ? (
                  <p className="text-xs text-destructive">Last error: {health.lastError}</p>
                ) : null}
                {bot.reasons.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">{bot.reasons.join(" · ")}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted-foreground">
          Outbox dual-write {ops.readiness.outboxDualWrite ? "on" : "off"} · Fan-out{" "}
          {ops.readiness.secretaryAuditFanout ? "on" : "off"} · Premium embeds{" "}
          {ops.readiness.productPremiumEmbeds ? "on" : "off"} · Role sync{" "}
          {ops.readiness.roleSyncEnabled ? "on" : "off"}
        </p>
        {ops.health.secretaryAuditFanoutEnabled ? (
          <p className="text-xs text-muted-foreground">
            Fan-out destinations — pending {ops.health.fanout.destinationSuffixedPending ?? "—"} ·
            failed {ops.health.fanout.destinationSuffixedFailed ?? "—"} · dead{" "}
            {ops.health.fanout.destinationSuffixedDead ?? "—"}
          </p>
        ) : null}
        {ops.readiness.crossRoutingWarnings.length > 0 ? (
          <p className="text-xs text-destructive">
            Config warnings: {ops.readiness.crossRoutingWarnings.join(" · ")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Oldest pending age: {formatAge(ops.oldestPendingAgeMs)}
          {ops.recoveredStaleProcessing > 0
            ? ` · Recovered ${ops.recoveredStaleProcessing} stale processing`
            : ""}
        </p>
      </div>

      {/* Recent outbox (collapsed by default) */}
      <div className="space-y-2">
        <button
          type="button"
          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          onClick={() => setShowRecent((v) => !v)}
        >
          {showRecent ? "Hide" : "Show"} recent outbox ({ops.recent.length})
        </button>
        {showRecent ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {ops.recent.map((row) => {
              const canRetry =
                row.status === "FAILED" || row.status === "DEAD" || row.status === "PROCESSING";
              const canReplay = row.status === "SENT" || row.status === "DEAD";
              return (
                <li key={row.id} className="rounded-md border border-border px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">
                        {row.eventType} → {row.targetBot}
                      </p>
                      <p className="text-muted-foreground">
                        {row.status} · attempts {row.attempts}/{row.maxAttempts} · {row.payloadKind ?? "—"}
                      </p>
                      {row.sanitizedPreview ? (
                        <p className="text-muted-foreground">{row.sanitizedPreview}</p>
                      ) : null}
                      {row.lastError ? <p className="text-destructive">{row.lastError}</p> : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 disabled:opacity-50"
                        disabled={uiLab || Boolean(busy)}
                        onClick={() =>
                          void loadDetail({ data: row.id }).then((d) => setDetail(d)).catch(() => {})
                        }
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 disabled:opacity-50"
                        disabled={uiLab || !canRetry || busy === `retry:${row.id}`}
                        title={uiLab ? unavailableLabel("Retry delivery") : canRetry ? "Requeue delivery" : "Not retryable"}
                        onClick={() => void runRetryOutbox(row)}
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 disabled:opacity-50"
                        disabled={uiLab || !canReplay || busy === `replay:${row.id}`}
                        title={uiLab ? unavailableLabel("Replay delivery") : "Create a new outbox row"}
                        onClick={() => void runReplayOutbox(row)}
                      >
                        Replay
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {detail ? (
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex justify-between gap-2">
              <p className="font-medium text-foreground">Outbox detail</p>
              <button type="button" className="text-muted-foreground" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            <p className="mt-1 text-muted-foreground">
              {detail.eventType} · {detail.targetBot} · {detail.channelClass} · {detail.status}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">{detail.idempotencyKeyPreview}</p>
            {detail.sanitizedPreview ? <p className="mt-1">{detail.sanitizedPreview}</p> : null}
          </div>
        ) : null}
      </div>

      {/* Per-user roles */}
      {roles ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground">Roles for this customer</h4>
          <p className="text-xs text-muted-foreground">
            Identity: {roles.discordUsername ?? "—"}{" "}
            {roles.discordId ? `(${roles.discordId})` : "(unlinked)"} · Role sync{" "}
            {roles.roleSyncEnabled ? "enabled" : "disabled"}
          </p>
          <ul className="space-y-2">
            {roles.roles.map((role) => {
              const canRetry =
                Boolean(role.outbox.outboxId) &&
                (role.outbox.status === "FAILED" ||
                  role.outbox.status === "DEAD" ||
                  role.outbox.status === "PROCESSING");
              return (
                <li key={role.productRole} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-foreground">{role.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Owner bot: {role.ownerBot} · Configured: {role.configured ? "yes" : "no"}
                      </p>
                      <p className="text-xs text-muted-foreground">Eligibility: {role.eligibilityLabel}</p>
                      <p className="text-xs text-muted-foreground">Live Discord: {liveRoleLabel(role)}</p>
                      <p className="text-xs text-muted-foreground">
                        Outbox: {outboxStateLabel(role)}
                        {role.outbox.retryCount != null ? ` · retries ${role.outbox.retryCount}` : ""}
                      </p>
                      {role.lastFailureReason ? (
                        <p className="text-xs text-destructive">Last failure: {role.lastFailureReason}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                      className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                      disabled={uiLab || !role.configured || busy === `reconcile:${role.productRole}`}
                      title={uiLab ? unavailableLabel("Reconcile role") : "Reconcile against eligibility"}
                        onClick={() => void runReconcile(role.productRole)}
                      >
                        {busy === `reconcile:${role.productRole}` ? "Working…" : "Reconcile"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                        disabled={uiLab || !canRetry || busy === `retry-role:${role.productRole}`}
                      title={
                        uiLab
                          ? unavailableLabel("Retry role sync")
                            : canRetry
                              ? "Requeue failed/dead/stuck role sync"
                              : "No failed outbox row"
                        }
                        onClick={() => void runRetryRole(role)}
                      >
                        {busy === `retry-role:${role.productRole}` ? "Working…" : "Retry failed sync"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Role synchronization is unavailable for this customer record. Delivery health remains available above.
        </p>
      )}
    </section>
  );
}

/** @deprecated Prefer InternalDiscordOpsPanel — kept for import compatibility. */
export { InternalDiscordOpsPanel as InternalDiscordRolePanel };
