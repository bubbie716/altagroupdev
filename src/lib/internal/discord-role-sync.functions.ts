/**
 * Internal/admin Discord role reconciliation controls (Phase 5–6).
 */

import { createServerFn } from "@tanstack/react-start";
import type { DiscordProductRoleKey } from "@/lib/discord/discord-product-role";

async function actor() {
  const { requireAuth } = await import("@/server/auth.service");
  return requireAuth();
}

export const fetchDiscordRoleReconciliation = createServerFn({ method: "GET" })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const user = await actor();
    const { isAdmin } = await import("@/lib/auth/permissions");
    if (!isAdmin(user)) throw new Response("Forbidden", { status: 403 });

    const { getDiscordRoleReconciliationSnapshot } = await import(
      "@/server/discord-product-role.service"
    );
    // Do not pretend live Discord role state is known — panel shows unavailable unless fetched.
    return getDiscordRoleReconciliationSnapshot(userId, { fetchLiveRoles: false });
  });

export const reconcileDiscordProductRole = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      productRole: DiscordProductRoleKey;
      reason: string;
      confirm: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Reconcile Discord product role");

    if (!data.confirm) throw new Response("confirm required", { status: 400 });
    if (!data.reason?.trim()) throw new Response("reason required", { status: 400 });

    const user = await actor();
    const { isAdmin } = await import("@/lib/auth/permissions");
    if (!isAdmin(user)) throw new Response("Forbidden", { status: 403 });

    const { syncProductRoleForUserBestEffort, getDiscordRoleReconciliationSnapshot } = await import(
      "@/server/discord-product-role.service"
    );
    await syncProductRoleForUserBestEffort({
      productRole: data.productRole,
      altaUserId: data.userId,
      actorUserId: user.id,
      preferRevokeWhenIneligible: true,
    });

    try {
      const { writeAuditLog } = await import("@/server/audit.service");
      await writeAuditLog({
        actorUserId: user.id,
        action: "DISCORD_ROLE_RECONCILE",
        entityType: "USER",
        entityId: data.userId,
        targetUserId: data.userId,
        description: `Reconcile Discord role ${data.productRole}`,
        metadata: { reason: data.reason.trim(), productRole: data.productRole },
      });
    } catch {
      /* best-effort */
    }

    return {
      ok: true,
      reason: data.reason.trim(),
      snapshot: await getDiscordRoleReconciliationSnapshot(data.userId, {
        fetchLiveRoles: false,
      }),
    };
  });

/** Re-queue a failed/dead/stuck-processing role_mgmt outbox row for the user's product role. */
export const retryDiscordRoleSyncOutbox = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      userId: string;
      productRole: DiscordProductRoleKey;
      outboxId: string;
      reason: string;
      confirm: boolean;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { assertNotUiLabMutation } = await import("@/lib/internal/ui-lab-mutation-gate");
    assertNotUiLabMutation("Retry Discord role sync outbox");

    if (!data.confirm) throw new Response("confirm required", { status: 400 });
    if (!data.reason?.trim()) throw new Response("reason required", { status: 400 });
    if (!data.outboxId?.trim()) throw new Response("outboxId required", { status: 400 });

    const user = await actor();
    const { isAdmin } = await import("@/lib/auth/permissions");
    if (!isAdmin(user)) throw new Response("Forbidden", { status: 403 });

    const { prisma } = await import("@/server/db");
    const { getDiscordRoleReconciliationSnapshot } = await import(
      "@/server/discord-product-role.service"
    );

    const eventPrefix =
      data.productRole === "bank_client"
        ? "BANK_CLIENT_ROLE_"
        : data.productRole === "terminal_investor"
          ? "TERMINAL_INVESTOR_ROLE_"
          : "SECRETARY_STAFF_ROLE_";

    const row = await prisma.discordOutbox.findFirst({
      where: {
        id: data.outboxId,
        channelClass: "role_mgmt",
        eventType: { startsWith: eventPrefix },
        status: { in: ["FAILED", "DEAD", "PROCESSING"] },
      },
      select: { id: true, status: true },
    });
    if (!row) throw new Response("outbox row not found or not retryable", { status: 404 });

    await prisma.discordOutbox.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date(),
        lastError: null,
      },
    });

    return {
      ok: true,
      reason: data.reason.trim(),
      snapshot: await getDiscordRoleReconciliationSnapshot(data.userId, {
        fetchLiveRoles: false,
      }),
    };
  });
