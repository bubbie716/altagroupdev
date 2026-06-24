import { canAccessInternal } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import {
  DISCORD_CHANNELS,
  type DiscordEmbedDraft,
  type DiscordEmbedPayload,
  type SendDiscordEmbedResult,
} from "@/lib/discord/embed-types";
import {
  hexToDiscordColor,
  isValidDiscordChannelId,
  isValidHttpUrl,
  normalizeChannelId,
  resolveEmbedColorHex,
} from "@/lib/discord/embed-utils";
import { validateEmbedDraft } from "@/lib/discord/embed-validation";
import { readCookie, getSessionCookieName } from "@/server/session";
import { loadUserBySessionToken } from "@/server/session.service";

// TODO: Add rate limiting per operator before production Discord sending.

type DiscordBotConfig = {
  botToken: string;
  guildId: string;
};

function trim(value: string): string {
  return value.trim();
}

function optionalUrl(value: string): string | undefined {
  const trimmed = trim(value);
  return trimmed && isValidHttpUrl(trimmed) ? trimmed : undefined;
}

export function getDiscordBotConfig(): DiscordBotConfig | null {
  const botToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!botToken || !guildId) return null;
  return { botToken, guildId };
}

export function isDiscordSendingConfigured(): boolean {
  return getDiscordBotConfig() !== null;
}

export function listChannelPresets(): { label: string; channelId: string }[] {
  return DISCORD_CHANNELS.map((channel) => ({
    label: channel.label,
    channelId: process.env[channel.envKey]?.trim() || channel.mockId,
  }));
}

export function resolveChannelId(channelId: string): string {
  const normalized = normalizeChannelId(channelId);
  if (!isValidDiscordChannelId(normalized)) throw new Error("INVALID_CHANNEL");
  return normalized;
}

export function buildDiscordEmbedPayload(draft: DiscordEmbedDraft): Record<string, unknown> {
  const embed: Record<string, unknown> = {
    color: hexToDiscordColor(resolveEmbedColorHex(draft)),
  };

  const title = trim(draft.title);
  const description = trim(draft.description);
  const url = optionalUrl(draft.url);
  const authorName = trim(draft.authorName);
  const footerText = trim(draft.footerText);

  if (title) embed.title = title;
  if (description) embed.description = description;
  if (url) embed.url = url;

  const authorIcon = optionalUrl(draft.authorIconUrl);
  if (authorName || authorIcon) {
    embed.author = {
      ...(authorName ? { name: authorName.slice(0, 256) } : {}),
      ...(authorIcon ? { icon_url: authorIcon } : {}),
    };
  }

  const thumbnail = optionalUrl(draft.thumbnailUrl);
  if (thumbnail) embed.thumbnail = { url: thumbnail };

  const image = optionalUrl(draft.imageUrl);
  if (image) embed.image = { url: image };

  const fields = draft.fields
    .filter((field) => trim(field.name) && trim(field.value))
    .map((field) => ({
      name: trim(field.name).slice(0, 256),
      value: trim(field.value).slice(0, 1024),
      inline: field.inline,
    }));

  if (fields.length > 0) embed.fields = fields;

  const footerIcon = optionalUrl(draft.footerIconUrl);
  if (footerText || footerIcon) {
    embed.footer = {
      ...(footerText ? { text: footerText.slice(0, 2048) } : {}),
      ...(footerIcon ? { icon_url: footerIcon } : {}),
    };
  }

  if (draft.includeTimestamp) {
    embed.timestamp = new Date().toISOString();
  }

  return embed;
}

export function buildDiscordButtonComponents(
  draft: DiscordEmbedDraft,
): Record<string, unknown>[] | undefined {
  const buttons = draft.buttons.filter((b) => trim(b.label) && optionalUrl(b.url));
  if (buttons.length === 0) return undefined;

  return [
    {
      type: 1,
      components: buttons.slice(0, 5).map((button) => ({
        type: 2,
        style: 5,
        label: trim(button.label).slice(0, 80),
        url: optionalUrl(button.url),
      })),
    },
  ];
}

export function buildSendPayload(draft: DiscordEmbedDraft): DiscordEmbedPayload {
  return {
    channelId: resolveChannelId(draft.channelId),
    embed: buildDiscordEmbedPayload(draft),
    components: buildDiscordButtonComponents(draft),
  };
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
  if (!canAccessInternal(user)) throw new Error("FORBIDDEN");
  return user;
}

async function postDiscordMessage(
  config: DiscordBotConfig,
  channelId: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${config.botToken}`,
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

export async function sendDiscordEmbed(draft: DiscordEmbedDraft): Promise<SendDiscordEmbedResult> {
  const validation = validateEmbedDraft(draft);
  if (!validation.valid) {
    return {
      ok: false,
      mode: "simulated",
      message: "Embed validation failed.",
      validationErrors: validation.errors,
    };
  }

  const payload = buildSendPayload(draft);
  const config = getDiscordBotConfig();

  if (!config) {
    return {
      ok: true,
      mode: "simulated",
      message: "Embed validated. Discord sending is not configured.",
    };
  }

  const body: Record<string, unknown> = {
    embeds: [payload.embed],
  };
  if (payload.components) body.components = payload.components;

  const messageId = await postDiscordMessage(config, payload.channelId, body);

  return {
    ok: true,
    mode: "sent",
    message: "Embed sent to Discord.",
    messageId,
  };
}

export async function handleDiscordEmbedRequest(
  request: Request,
  draft: DiscordEmbedDraft,
): Promise<SendDiscordEmbedResult> {
  await requireOperatorFromRequest(request);
  return sendDiscordEmbed(draft);
}
