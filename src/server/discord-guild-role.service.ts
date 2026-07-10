import { getDiscordBotConfig } from "@/server/discord-embed.service";
import { prisma } from "@/server/db";

export type GrantDiscordRoleResult =
  | { ok: true }
  | { ok: false; reason: string };

function logRoleGrant(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[discord-guild-role] ${message}`, meta ?? {});
}

export function resolveDiscordPrivateRoleId(): string | undefined {
  return process.env.DISCORD_PRIVATE_ROLE_ID?.trim() || undefined;
}

export function resolveDiscordClientRoleId(): string | undefined {
  return process.env.DISCORD_CLIENT_ROLE_ID?.trim() || undefined;
}

export async function grantDiscordGuildRole(
  discordUserId: string,
  roleId: string,
): Promise<GrantDiscordRoleResult> {
  const config = getDiscordBotConfig();
  if (!config) return { ok: false, reason: "discord_not_configured" };

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${config.guildId}/members/${discordUserId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bot ${config.botToken}` },
    },
  );

  if (response.ok) return { ok: true };
  if (response.status === 404) return { ok: false, reason: "member_not_in_guild" };

  const detail = await response.text();
  return {
    ok: false,
    reason: detail.slice(0, 200) || `discord_api_${response.status}`,
  };
}

export async function grantDiscordPrivateRole(
  discordUserId: string,
): Promise<GrantDiscordRoleResult> {
  const roleId = resolveDiscordPrivateRoleId();
  if (!roleId) return { ok: false, reason: "private_role_not_configured" };
  return grantDiscordGuildRole(discordUserId, roleId);
}

export async function grantDiscordClientRole(
  discordUserId: string,
): Promise<GrantDiscordRoleResult> {
  const roleId = resolveDiscordClientRoleId();
  if (!roleId) return { ok: false, reason: "client_role_not_configured" };
  return grantDiscordGuildRole(discordUserId, roleId);
}

export async function grantDiscordPrivateRoleForUser(
  userId: string,
): Promise<GrantDiscordRoleResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { discordId: true },
  });
  if (!user?.discordId) return { ok: false, reason: "user_not_linked" };
  return grantDiscordPrivateRole(user.discordId);
}

export async function grantDiscordClientRoleBestEffort(discordUserId: string): Promise<void> {
  const result = await grantDiscordClientRole(discordUserId);
  if (result.ok) {
    logRoleGrant("client role granted", { discordUserId });
    return;
  }
  if (result.reason === "client_role_not_configured") return;
  logRoleGrant("client role grant failed", { discordUserId, reason: result.reason });
}

export async function grantDiscordPrivateRoleBestEffortForUser(userId: string): Promise<void> {
  const result = await grantDiscordPrivateRoleForUser(userId);
  if (result.ok) {
    logRoleGrant("private role granted", { userId });
    return;
  }
  if (result.reason === "private_role_not_configured") return;
  logRoleGrant("private role grant failed", { userId, reason: result.reason });
}

export type DiscordGuildRoleJoinSyncResult =
  | { synced: false; reason: "no_alta_account" }
  | {
      synced: true;
      clientGranted: boolean;
      privateGranted: boolean;
      clientSkipped?: boolean;
      privateSkipped?: boolean;
    };

/** Grant Discord guild roles when a member joins — based on linked Alta account + tags. */
export async function syncDiscordGuildRolesForJoin(
  discordUserId: string,
): Promise<DiscordGuildRoleJoinSyncResult> {
  const user = await prisma.user.findUnique({
    where: { discordId: discordUserId },
    select: {
      id: true,
      tags: { where: { tag: "PRIVATE_CLIENT" }, select: { tag: true } },
    },
  });

  if (!user) {
    return { synced: false, reason: "no_alta_account" };
  }

  let clientGranted = false;
  let privateGranted = false;
  const clientSkipped = resolveDiscordClientRoleId() == null;
  const privateSkipped = resolveDiscordPrivateRoleId() == null;

  const clientResult = await grantDiscordClientRole(discordUserId);
  if (clientResult.ok) {
    clientGranted = true;
    logRoleGrant("join sync granted client role", { discordUserId, userId: user.id });
  } else if (clientResult.reason !== "client_role_not_configured") {
    logRoleGrant("join sync client role failed", { discordUserId, reason: clientResult.reason });
  }

  const isPrivateClient = user.tags.length > 0;
  if (isPrivateClient) {
    const privateResult = await grantDiscordPrivateRole(discordUserId);
    if (privateResult.ok) {
      privateGranted = true;
      logRoleGrant("join sync granted private role", { discordUserId, userId: user.id });
    } else if (privateResult.reason !== "private_role_not_configured") {
      logRoleGrant("join sync private role failed", { discordUserId, reason: privateResult.reason });
    }
  }

  return {
    synced: true,
    clientGranted,
    privateGranted,
    ...(clientSkipped ? { clientSkipped: true } : {}),
    ...(privateSkipped && isPrivateClient ? { privateSkipped: true } : {}),
  };
}
