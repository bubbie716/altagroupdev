/**
 * Bank client Discord guild role helpers.
 * Phase 5: delegates to shared product-role service; keeps legacy API names.
 */

import { isDiscordLiveDeliveryDisabled } from "@/lib/discord/discord-delivery-guard";
import { resolveBankClientRoleId } from "@/lib/discord/discord-product-role";
import { prisma } from "@/server/db";

export type GrantDiscordRoleResult =
  | { ok: true }
  | { ok: false; reason: string };

function logRoleGrant(message: string, meta?: Record<string, unknown>): void {
  if (isDiscordLiveDeliveryDisabled()) return;
  console.info(`[discord-guild-role] ${message}`, meta ?? {});
}

/** @deprecated Prefer resolveBankClientRoleId — kept for existing call sites. */
export function resolveDiscordClientRoleId(): string | undefined {
  return resolveBankClientRoleId() ?? undefined;
}

export async function grantDiscordGuildRole(
  discordUserId: string,
  roleId: string,
): Promise<GrantDiscordRoleResult> {
  const expected = resolveBankClientRoleId();
  if (!expected || expected !== roleId) {
    // Hard rule: Bank helper only touches the Bank client role ID.
    return { ok: false, reason: "cross_product_role_refused" };
  }

  const { applyDiscordProductRole } = await import("@/server/discord-product-role.service");
  const result = await applyDiscordProductRole({
    productRole: "bank_client",
    action: "grant",
    discordUserId,
    reason: "legacy_grantDiscordGuildRole",
    requiredTargetBot: "bank",
    skipEligibilityCheck: true,
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

export async function grantDiscordClientRole(
  discordUserId: string,
): Promise<GrantDiscordRoleResult> {
  const roleId = resolveBankClientRoleId();
  if (!roleId) return { ok: false, reason: "client_role_not_configured" };
  return grantDiscordGuildRole(discordUserId, roleId);
}

export async function grantDiscordClientRoleBestEffort(discordUserId: string): Promise<void> {
  const { grantBankClientRoleBestEffort } = await import(
    "@/server/discord-product-role.service"
  );
  const user = await prisma.user.findUnique({
    where: { discordId: discordUserId },
    select: { id: true },
  });
  await grantBankClientRoleBestEffort(discordUserId, user?.id);
}

export type DiscordGuildRoleJoinSyncResult =
  | { synced: false; reason: "no_alta_account" }
  | {
      synced: true;
      clientGranted: boolean;
      clientSkipped?: boolean;
    };

/** Grant Discord guild roles when a member joins — based on linked Alta account. */
export async function syncDiscordGuildRolesForJoin(
  discordUserId: string,
): Promise<DiscordGuildRoleJoinSyncResult> {
  const user = await prisma.user.findUnique({
    where: { discordId: discordUserId },
    select: { id: true },
  });

  if (!user) {
    return { synced: false, reason: "no_alta_account" };
  }

  let clientGranted = false;
  const clientSkipped = resolveBankClientRoleId() == null;

  const clientResult = await grantDiscordClientRole(discordUserId);
  if (clientResult.ok) {
    clientGranted = true;
    logRoleGrant("join sync granted client role", { discordUserId, userId: user.id });
  } else if (clientResult.reason !== "client_role_not_configured") {
    logRoleGrant("join sync client role failed", { discordUserId, reason: clientResult.reason });
  }

  return {
    synced: true,
    clientGranted,
    ...(clientSkipped ? { clientSkipped: true } : {}),
  };
}
