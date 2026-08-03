/**
 * Internal Discord operations controls (Phase 8) — extends role-sync panel APIs.
 */

import { createServerFn } from "@tanstack/react-start";
import type { DiscordProductRoleKey } from "@/lib/discord/discord-product-role";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

async function requireAdmin() {
  const user = await actor();
  const { isAdmin } = await import("@/lib/auth/permissions");
  if (!isAdmin(user)) throw new Response("Forbidden", { status: 403 });
  return user;
}

export const fetchDiscordOpsSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { getDiscordOutboxOpsSnapshot } = await import("@/server/discord-outbox-ops.service");
  return getDiscordOutboxOpsSnapshot({ limit: 40, recoverStale: true });
});

export const fetchDiscordOutboxRowDetail = createServerFn({ method: "GET" })
  .inputValidator((outboxId: string) => outboxId)
  .handler(async ({ data: outboxId }) => {
    await requireAdmin();
    const { getDiscordOutboxRowDetail } = await import("@/server/discord-outbox-ops.service");
    return getDiscordOutboxRowDetail(outboxId);
  });

export const retryDiscordOutboxRow = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { outboxId: string; reason: string; confirm: boolean }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Retry Discord outbox delivery");
    if (!data.confirm) throw new Response("confirm required", { status: 400 });
    if (!data.reason?.trim()) throw new Response("reason required", { status: 400 });

    const user = await requireAdmin();
    const { retryDiscordOutboxDelivery, getDiscordOutboxOpsSnapshot } = await import(
      "@/server/discord-outbox-ops.service"
    );
    const result = await retryDiscordOutboxDelivery({
      outboxId: data.outboxId,
      actorUserId: user.id,
      reason: data.reason.trim(),
    });
    if (!result.ok) throw new Response(result.reason, { status: 400 });
    return {
      ok: true,
      row: result.row,
      snapshot: await getDiscordOutboxOpsSnapshot({ limit: 40 }),
    };
  });

export const replayDiscordOutboxRow = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { outboxId: string; reason: string; confirm: boolean }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Replay Discord outbox delivery");
    if (!data.confirm) throw new Response("confirm required", { status: 400 });
    if (!data.reason?.trim()) throw new Response("reason required", { status: 400 });

    const user = await requireAdmin();
    const { replayDiscordOutboxDelivery, getDiscordOutboxOpsSnapshot } = await import(
      "@/server/discord-outbox-ops.service"
    );
    const result = await replayDiscordOutboxDelivery({
      outboxId: data.outboxId,
      actorUserId: user.id,
      reason: data.reason.trim(),
    });
    if (!result.ok) throw new Response(result.reason, { status: 400 });
    return {
      ok: true,
      row: result.row,
      snapshot: await getDiscordOutboxOpsSnapshot({ limit: 40 }),
    };
  });

/** Re-export role sync helpers for the combined Discord operations panel. */
export {
  fetchDiscordRoleReconciliation,
  reconcileDiscordProductRole,
  retryDiscordRoleSyncOutbox,
} from "@/lib/internal/discord-role-sync.functions";

export type { DiscordProductRoleKey };
