import { DEAL_ROOM_CHANNEL_CLOSED_NOTICE, buildDealRoomChannelWelcomeContent } from "@/lib/bank/secure-deal-room-discord-copy";
import { buildNotificationDmPayload, resolvePublicLinkUrl } from "@/lib/discord/notification-dm";
import { getDiscordBotConfig } from "@/server/discord-embed.service";
import type {
  EnsureChannelDispatchInput,
  EnsureChannelDispatchResult,
} from "@/lib/bank/secure-deal-room-discord-types";

const VIEW_CHANNEL = 1 << 10;
const SEND_MESSAGES = 1 << 11;
const READ_MESSAGE_HISTORY = 1 << 16;
const MANAGE_CHANNELS = 1 << 4;
const MANAGE_MESSAGES = 1 << 13;

const CUSTOMER_PERMS = VIEW_CHANNEL | SEND_MESSAGES | READ_MESSAGE_HISTORY;
const STAFF_PERMS = CUSTOMER_PERMS;
const BOT_PERMS = CUSTOMER_PERMS | MANAGE_CHANNELS | MANAGE_MESSAGES;

let cachedBotUserId: string | null = null;

function staffRoleIds(): string[] {
  return (process.env.DISCORD_DEAL_ROOM_STAFF_ROLE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function dealRoomCategoryId(): string | undefined {
  return process.env.DISCORD_DEAL_ROOM_CATEGORY_ID?.trim() || undefined;
}

function closedDealRoomCategoryId(): string | undefined {
  return process.env.DISCORD_CLOSED_DEAL_ROOM_CATEGORY_ID?.trim() || undefined;
}

async function discordApi<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: T; status: number; detail?: string }> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let data: T | undefined;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = undefined;
    }
  }
  if (!response.ok) {
    return { ok: false, status: response.status, detail: text.slice(0, 300) };
  }
  return { ok: true, data, status: response.status };
}

async function getBotUserId(token: string): Promise<string> {
  if (cachedBotUserId) return cachedBotUserId;
  const result = await discordApi<{ id: string }>(token, "/users/@me");
  if (!result.ok || !result.data?.id) {
    throw new Error("bot_user_lookup_failed");
  }
  cachedBotUserId = result.data.id;
  return cachedBotUserId;
}

function buildPermissionOverwrites(
  guildId: string,
  customerDiscordUserId: string,
  botUserId: string,
  removeApplicant = false,
) {
  const overwrites: Array<{ id: string; type: number; allow?: string; deny?: string }> = [
    { id: guildId, type: 0, deny: String(VIEW_CHANNEL) },
    { id: botUserId, type: 1, allow: String(BOT_PERMS) },
  ];

  if (!removeApplicant) {
    overwrites.push({
      id: customerDiscordUserId,
      type: 1,
      allow: String(CUSTOMER_PERMS),
    });
  }

  for (const roleId of staffRoleIds()) {
    overwrites.push({ id: roleId, type: 0, allow: String(STAFF_PERMS) });
  }

  return overwrites;
}

export async function directEnsureDealRoomChannel(
  input: EnsureChannelDispatchInput,
): Promise<EnsureChannelDispatchResult> {
  const config = getDiscordBotConfig();
  if (!config) return { ok: false, reason: "discord_not_configured" };

  if (input.existingChannelId) {
    const existing = await discordApi<{ id: string; name: string }>(
      config.botToken,
      `/channels/${input.existingChannelId}`,
    );
    if (existing.ok && existing.data) {
      return {
        ok: true,
        channelId: existing.data.id,
        channelName: existing.data.name,
        linked: true,
      };
    }
  }

  const botUserId = await getBotUserId(config.botToken);
  const createResult = await discordApi<{ id: string; name: string }>(
    config.botToken,
    `/guilds/${config.guildId}/channels`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.channelName,
        type: 0,
        parent_id: dealRoomCategoryId(),
        topic: `Secure Deal Room · ${input.dealRoomType} · ${input.dealRoomId}`,
        permission_overwrites: buildPermissionOverwrites(
          config.guildId,
          input.customerDiscordUserId,
          botUserId,
        ),
      }),
    },
  );

  if (!createResult.ok || !createResult.data) {
    return {
      ok: false,
      reason: createResult.detail ?? `discord_api_${createResult.status}`,
    };
  }

  const welcomePayload = buildNotificationDmPayload({
    title: "Alta Bank Secure Deal Room",
    body: input.welcomeContent || buildDealRoomChannelWelcomeContent(),
    linkUrl: input.linkUrl,
    linkLabel: "Open on Alta Bank",
  });

  const welcomeResult = await discordApi(config.botToken, `/channels/${createResult.data.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: welcomePayload.embed,
      components: welcomePayload.components,
    }),
  });

  if (!welcomeResult.ok) {
    return {
      ok: true,
      channelId: createResult.data.id,
      channelName: createResult.data.name,
      linked: false,
      reason: "welcome_message_failed",
    };
  }

  return {
    ok: true,
    channelId: createResult.data.id,
    channelName: createResult.data.name,
    linked: false,
  };
}

export async function directPostDealRoomChannelMessage(input: {
  channelId: string;
  content: string;
}): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  const config = getDiscordBotConfig();
  if (!config) return { ok: false, reason: "discord_not_configured" };

  const result = await discordApi<{ id: string }>(
    config.botToken,
    `/channels/${input.channelId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content: input.content.slice(0, 2000) }),
    },
  );

  if (!result.ok || !result.data?.id) {
    return { ok: false, reason: result.detail ?? `discord_api_${result.status}` };
  }

  return { ok: true, messageId: result.data.id };
}

export async function directLockDealRoomChannel(input: {
  channelId: string;
  customerDiscordUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const config = getDiscordBotConfig();
  if (!config) return { ok: false, reason: "discord_not_configured" };

  const botUserId = await getBotUserId(config.botToken);
  const patchBody: Record<string, unknown> = {
    permission_overwrites: buildPermissionOverwrites(
      config.guildId,
      input.customerDiscordUserId,
      botUserId,
      true,
    ),
  };
  const closedCategory = closedDealRoomCategoryId();
  if (closedCategory) {
    patchBody.parent_id = closedCategory;
  }

  const lockResult = await discordApi(config.botToken, `/channels/${input.channelId}`, {
    method: "PATCH",
    body: JSON.stringify(patchBody),
  });
  if (!lockResult.ok) {
    return { ok: false, reason: lockResult.detail ?? `discord_api_${lockResult.status}` };
  }

  const closedLink = resolvePublicLinkUrl("/bank");
  const notice = buildNotificationDmPayload({
    title: "Secure Deal Room closed",
    body: DEAL_ROOM_CHANNEL_CLOSED_NOTICE,
    linkUrl: closedLink,
    linkLabel: "Open Alta Bank",
  });

  await discordApi(config.botToken, `/channels/${input.channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      embeds: notice.embed,
      components: notice.components,
    }),
  });

  return { ok: true };
}

export async function directDeleteDealRoomChannel(channelId: string): Promise<{
  ok: boolean;
  reason?: string;
}> {
  const config = getDiscordBotConfig();
  if (!config) return { ok: false, reason: "discord_not_configured" };

  const result = await discordApi(config.botToken, `/channels/${channelId}`, {
    method: "DELETE",
  });

  if (result.ok || result.status === 404) {
    return { ok: true };
  }

  return { ok: false, reason: result.detail ?? `discord_api_${result.status}` };
}
