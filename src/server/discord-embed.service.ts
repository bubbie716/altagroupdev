import { canAccessBankInternal } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import {
  DISCORD_SERVERS,
  type DiscordMessageDraft,
  type DiscordServerKey,
  type SendDiscordMessageResult,
} from "@/lib/discord/embed-types";
import { isValidDiscordChannelId, normalizeChannelId } from "@/lib/discord/embed-utils";
import { validateMessageDraft } from "@/lib/discord/embed-validation";
import { readCookie, getSessionCookieName } from "@/server/session";
import { loadUserBySessionToken } from "@/server/session.service";

// TODO: Add rate limiting per operator before production Discord sending.

type DiscordBotConfig = {
  botToken: string;
  guildId: string;
};

/** Shared Bank bot used by deal rooms, DMs, staff audit, guild roles. */
export function getDiscordBotConfig(): DiscordBotConfig | null {
  const botToken = process.env.DISCORD_BANK_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_BANK_GUILD_ID?.trim();
  if (!botToken || !guildId) return null;
  return { botToken, guildId };
}

export type DiscordServerConfig = {
  key: DiscordServerKey;
  label: string;
  configured: boolean;
};

function readCommunicationsBotToken(serverKey: DiscordServerKey): string | null {
  const server = DISCORD_SERVERS.find((item) => item.key === serverKey);
  if (!server) return null;
  return process.env[server.envKey]?.trim() || null;
}

/** Communications bots — Corporate / Terminal / Bank. */
export function listDiscordServers(): DiscordServerConfig[] {
  return DISCORD_SERVERS.map((server) => ({
    key: server.key,
    label: server.label,
    configured: Boolean(readCommunicationsBotToken(server.key)),
  }));
}

export function isDiscordSendingConfigured(): boolean {
  return DISCORD_SERVERS.some((server) => Boolean(readCommunicationsBotToken(server.key)));
}

export function resolveChannelId(channelId: string): string {
  const normalized = normalizeChannelId(channelId);
  if (!isValidDiscordChannelId(normalized)) throw new Error("INVALID_CHANNEL");
  return normalized;
}

export async function requireOperatorFromRequest(request: Request): Promise<AltaUser> {
  const cookieHeader = request.headers.get("cookie");
  const token = readCookie(getSessionCookieName(), cookieHeader);
  if (!token) throw new Error("UNAUTHORIZED");

  const user = await loadUserBySessionToken(token);
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.accountStatus === "frozen" || user.accountStatus === "restricted") {
    throw new Error("ACCOUNT_RESTRICTED");
  }
  if (!canAccessBankInternal(user)) throw new Error("FORBIDDEN");
  return user;
}

async function postDiscordMessage(
  botToken: string,
  channelId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DISCORD_API_ERROR:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { id?: string };
  return data.id ?? "unknown";
}

export async function sendDiscordMessage(
  draft: DiscordMessageDraft,
): Promise<SendDiscordMessageResult> {
  const validation = validateMessageDraft(draft);
  if (!validation.valid) {
    return {
      ok: false,
      mode: "simulated",
      message: "Message validation failed.",
      validationErrors: validation.errors,
    };
  }

  const serverKey = draft.serverKey as DiscordServerKey;
  const channelId = resolveChannelId(draft.channelId);
  const content = draft.content.trim();
  const botToken = readCommunicationsBotToken(serverKey);
  const serverLabel =
    DISCORD_SERVERS.find((server) => server.key === serverKey)?.label ?? serverKey;

  if (!botToken) {
    return {
      ok: true,
      mode: "simulated",
      message: `Message validated. ${serverLabel} bot token is not configured.`,
    };
  }

  const messageId = await postDiscordMessage(botToken, channelId, { content });

  return {
    ok: true,
    mode: "sent",
    message: `Message sent via ${serverLabel} bot.`,
    messageId,
  };
}

/** @deprecated Use sendDiscordMessage. */
export async function sendDiscordEmbed(
  draft: DiscordMessageDraft,
): Promise<SendDiscordMessageResult> {
  return sendDiscordMessage(draft);
}

export async function handleDiscordEmbedRequest(
  request: Request,
  draft: DiscordMessageDraft,
): Promise<SendDiscordMessageResult> {
  await requireOperatorFromRequest(request);
  return sendDiscordMessage(draft);
}
