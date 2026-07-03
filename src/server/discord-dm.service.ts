import type { InvitationDmPayload } from "@/lib/discord/invitation-dm";
import { getDiscordBotConfig } from "@/server/discord-embed.service";

async function createDmChannel(botToken: string, recipientId: string): Promise<string> {
  const response = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: recipientId }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DISCORD_DM_CHANNEL_ERROR:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("DISCORD_DM_CHANNEL_ERROR:missing_channel_id");
  return data.id;
}

async function postChannelMessage(
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

export async function sendDiscordInvitationDm(
  discordUserId: string,
  payload: InvitationDmPayload,
): Promise<{ sent: true; messageId: string } | { sent: false; reason: "not_configured" }> {
  const config = getDiscordBotConfig();
  if (!config) return { sent: false, reason: "not_configured" };

  const channelId = await createDmChannel(config.botToken, discordUserId);
  const messageId = await postChannelMessage(config.botToken, channelId, {
    embeds: [payload.embed],
    components: payload.components,
  });

  return { sent: true, messageId };
}
