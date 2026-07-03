import { getDiscordBotConfig } from "@/server/discord-embed.service";

function staffAuditChannelId(): string | null {
  return process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID?.trim() || null;
}

function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "test") return;
  console.info(`[staff-audit-dispatch] ${message}`, meta ?? {});
}

function botInternalUrl(): string {
  return process.env.BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3847";
}

function botApiSecret(): string | null {
  return process.env.BOT_API_SECRET?.trim() || null;
}

async function postChannelTextMessage(
  botToken: string,
  channelId: string,
  content: string,
): Promise<string> {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ content: content.slice(0, 2000) }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DISCORD_API_ERROR:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { id?: string };
  return data.id ?? "unknown";
}

async function tryBotDelivery(content: string): Promise<boolean> {
  const secret = botApiSecret();
  if (!secret) {
    logDispatch("bot delivery skipped — BOT_API_SECRET not set");
    return false;
  }

  try {
    const response = await fetch(`${botInternalUrl()}/internal/staff-audit/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(5000),
    });

    const data = (await response.json().catch(() => ({}))) as {
      sent?: boolean;
      reason?: string;
    };

    if (response.ok && data.sent === true) {
      logDispatch("bot delivery sent");
      return true;
    }

    logDispatch("bot delivery failed", { status: response.status, reason: data.reason });
    return false;
  } catch (error) {
    logDispatch("bot delivery unreachable", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function dispatchStaffAuditDiscordMessage(
  content: string,
): Promise<{ sent: boolean; via: "direct" | "bot" | "none"; reason?: string }> {
  const channelId = staffAuditChannelId();
  if (!channelId) {
    return { sent: false, via: "none", reason: "channel_not_configured" };
  }

  const config = getDiscordBotConfig();
  if (config) {
    try {
      const messageId = await postChannelTextMessage(config.botToken, channelId, content);
      logDispatch("direct delivery sent", { messageId, channelId });
      return { sent: true, via: "direct" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logDispatch("direct delivery failed", { error: message });
    }
  } else {
    logDispatch("direct delivery skipped — Discord bot not configured");
  }

  const viaBot = await tryBotDelivery(content);
  if (viaBot) return { sent: true, via: "bot" };

  return { sent: false, via: "none", reason: "delivery_failed" };
}

export function getStaffAuditChannelIdForDelivery(): string | null {
  return staffAuditChannelId();
}

export async function deliverStaffAuditToDiscordChannel(content: string): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const channelId = staffAuditChannelId();
  if (!channelId) return { sent: false, reason: "channel_not_configured" };

  const config = getDiscordBotConfig();
  if (!config) return { sent: false, reason: "not_configured" };

  try {
    await postChannelTextMessage(config.botToken, channelId, content);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sent: false, reason: message };
  }
}
