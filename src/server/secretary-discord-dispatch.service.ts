/**
 * Alta Secretary Discord delivery — staff/ops/security/delivery-alert only.
 * Never sends customer DMs. Never falls back to the Bank bot token or Bank staff channel.
 */

import type { DiscordChannelClass, DiscordProductSource } from "@/lib/discord/discord-event-envelope";
import { isDiscordLiveDeliveryDisabled } from "@/lib/discord/discord-delivery-guard";
import { resolveStaffDiscordChannel } from "@/lib/discord/discord-channel-routing";

function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (isDiscordLiveDeliveryDisabled()) return;
  console.info(`[secretary-dispatch] ${message}`, meta ?? {});
}

export type SecretaryBotConfig = {
  botToken: string;
  guildId: string;
  applicationId: string | null;
};

/** Secretary bot credentials — never reuse Bank / Terminal / OAuth client ids. */
export function getSecretaryDiscordBotConfig(): SecretaryBotConfig | null {
  // Preferred name; DISCORD_CORPORATE_BOT_TOKEN is a legacy alias for the same app.
  const botToken =
    process.env.DISCORD_SECRETARY_BOT_TOKEN?.trim() ||
    process.env.DISCORD_CORPORATE_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_SECRETARY_GUILD_ID?.trim();
  if (!botToken || !guildId) return null;
  return {
    botToken,
    guildId,
    applicationId: process.env.DISCORD_SECRETARY_APPLICATION_ID?.trim() || null,
  };
}

export function isSecretaryDiscordConfigured(): boolean {
  return getSecretaryDiscordBotConfig() !== null;
}

function secretaryBotInternalUrl(): string {
  return process.env.SECRETARY_BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3848";
}

function secretaryBotApiSecret(): string | null {
  return (
    process.env.SECRETARY_BOT_API_SECRET?.trim() ||
    process.env.BOT_API_SECRET?.trim() ||
    null
  );
}

export type SecretaryDispatchOptions = {
  product?: DiscordProductSource;
  channelClass?: DiscordChannelClass;
  channelId?: string;
};

function resolveSecretaryChannel(options?: SecretaryDispatchOptions): {
  channelId: string | null;
  reason?: string;
  routeKey?: string;
} {
  if (options?.channelId?.trim()) {
    return { channelId: options.channelId.trim(), routeKey: "explicit" };
  }

  const product = options?.product ?? "secretary";
  const channelClass = options?.channelClass ?? "staff_ops";

  // Secretary delivery must never target Bank-only staff routes via product=bank.
  if (product === "bank" || product === "terminal") {
    if (channelClass !== "delivery_alert" && channelClass !== "security_audit") {
      return {
        channelId: null,
        reason: "secretary_refuses_bank_or_terminal_staff_ops",
        routeKey: "secretary_guard",
      };
    }
  }

  const route = resolveStaffDiscordChannel({ product, channelClass });
  if (!route.ok) {
    return { channelId: null, reason: route.reason, routeKey: route.routeKey };
  }

  // Fail closed: never accept the Bank staff channel for Secretary sends.
  const bankChannel = process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID?.trim();
  if (bankChannel && route.channelId === bankChannel && route.routeKey === "bank_staff_audit") {
    return {
      channelId: null,
      reason: "secretary_refuses_bank_staff_channel",
      routeKey: route.routeKey,
    };
  }

  return { channelId: route.channelId, routeKey: route.routeKey };
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
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DISCORD_API_ERROR:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { id?: string };
  return data.id ?? "unknown";
}

async function trySecretaryBotDelivery(content: string, channelId: string): Promise<boolean> {
  const secret = secretaryBotApiSecret();
  if (!secret) {
    logDispatch("bot delivery skipped — SECRETARY_BOT_API_SECRET/BOT_API_SECRET not set");
    return false;
  }

  try {
    const response = await fetch(`${secretaryBotInternalUrl()}/internal/staff-audit/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ content, channelId }),
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

export async function dispatchSecretaryStaffMessage(
  content: string,
  options?: SecretaryDispatchOptions,
): Promise<{ sent: boolean; via: "direct" | "bot" | "none"; reason?: string }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { sent: false, via: "none", reason: "disabled_in_test" };
  }

  const resolved = resolveSecretaryChannel(options);
  if (!resolved.channelId) {
    return { sent: false, via: "none", reason: resolved.reason ?? "channel_not_configured" };
  }

  const config = getSecretaryDiscordBotConfig();
  if (config) {
    try {
      const messageId = await postChannelTextMessage(config.botToken, resolved.channelId, content);
      logDispatch("direct delivery sent", {
        messageId,
        channelId: resolved.channelId,
        routeKey: resolved.routeKey,
      });
      return { sent: true, via: "direct" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logDispatch("direct delivery failed", { error: message });
    }
  } else {
    logDispatch("direct delivery skipped — Secretary bot not configured");
  }

  const viaBot = await trySecretaryBotDelivery(content, resolved.channelId);
  if (viaBot) return { sent: true, via: "bot" };

  return {
    sent: false,
    via: "none",
    reason: config ? "delivery_failed" : "secretary_bot_not_configured",
  };
}

/** Used by Secretary bot gateway fallback — posts with Secretary token only. */
export async function deliverSecretaryStaffToDiscordChannel(
  content: string,
  channelId?: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { sent: false, reason: "disabled_in_test" };
  }

  const resolved = resolveSecretaryChannel(
    channelId ? { channelId } : { product: "secretary", channelClass: "staff_ops" },
  );
  if (!resolved.channelId) {
    return { sent: false, reason: resolved.reason ?? "channel_not_configured" };
  }

  const config = getSecretaryDiscordBotConfig();
  if (!config) return { sent: false, reason: "secretary_bot_not_configured" };

  try {
    await postChannelTextMessage(config.botToken, resolved.channelId, content);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sent: false, reason: message };
  }
}

/** Test/ops helper — expose channel resolution without sending. */
export function resolveSecretaryDispatchChannelForTests(
  options?: SecretaryDispatchOptions,
): { channelId: string | null; reason?: string; routeKey?: string } {
  return resolveSecretaryChannel(options);
}
