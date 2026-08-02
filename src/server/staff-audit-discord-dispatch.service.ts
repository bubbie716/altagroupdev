import type { DiscordChannelClass, DiscordProductSource } from "@/lib/discord/discord-event-envelope";
import {
  isDiscordSecretaryDeliveryEnabled,
  isDiscordTerminalDeliveryEnabled,
} from "@/lib/discord/discord-event-envelope";
import { isDiscordLiveDeliveryDisabled } from "@/lib/discord/discord-delivery-guard";
import { resolveStaffDiscordChannel } from "@/lib/discord/discord-channel-routing";
import { getDiscordBotConfig } from "@/server/discord-embed.service";

function shouldUseTerminalPrimaryPath(product: DiscordProductSource): boolean {
  return isDiscordTerminalDeliveryEnabled() && product === "terminal";
}

function shouldUseSecretaryPrimaryPath(
  product: DiscordProductSource,
  channelClass: DiscordChannelClass,
): boolean {
  if (!isDiscordSecretaryDeliveryEnabled()) return false;
  if (channelClass === "delivery_alert") return true;
  return product === "secretary" || product === "ops" || product === "corporate";
}

function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (isDiscordLiveDeliveryDisabled()) return;
  console.info(`[staff-audit-dispatch] ${message}`, meta ?? {});
}

function botInternalUrl(): string {
  return process.env.BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3847";
}

function botApiSecret(): string | null {
  return process.env.BOT_API_SECRET?.trim() || null;
}

export type StaffAuditDispatchOptions = {
  product?: DiscordProductSource;
  channelClass?: DiscordChannelClass;
  /** Explicit channel override (bot bridge). */
  channelId?: string;
};

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

async function tryBotDelivery(content: string, channelId: string): Promise<boolean> {
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

function resolveChannel(options?: StaffAuditDispatchOptions): {
  channelId: string | null;
  reason?: string;
  routeKey?: string;
} {
  if (options?.channelId?.trim()) {
    return { channelId: options.channelId.trim(), routeKey: "explicit" };
  }

  const route = resolveStaffDiscordChannel({
    product: options?.product ?? "bank",
    channelClass: options?.channelClass ?? "staff_ops",
  });

  if (!route.ok) {
    return { channelId: null, reason: route.reason, routeKey: route.routeKey };
  }
  return { channelId: route.channelId, routeKey: route.routeKey };
}

export async function dispatchStaffAuditDiscordMessage(
  content: string,
  options?: StaffAuditDispatchOptions,
): Promise<{ sent: boolean; via: "direct" | "bot" | "none"; reason?: string }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { sent: false, via: "none", reason: "disabled_in_test" };
  }

  const product = options?.product ?? "bank";
  const channelClass = options?.channelClass ?? "staff_ops";

  // Phase 4: Terminal-owned staff uses the Terminal bot only (fail closed — no Bank fallback).
  if (shouldUseTerminalPrimaryPath(product)) {
    const { dispatchTerminalStaffMessage } = await import(
      "@/server/terminal-discord-dispatch.service"
    );
    return dispatchTerminalStaffMessage(content, {
      product,
      channelClass,
      channelId: options?.channelId,
    });
  }

  // Phase 3: Secretary-owned staff/delivery alerts use the Secretary bot only.
  if (shouldUseSecretaryPrimaryPath(product, channelClass)) {
    const { dispatchSecretaryStaffMessage } = await import(
      "@/server/secretary-discord-dispatch.service"
    );
    return dispatchSecretaryStaffMessage(content, {
      product,
      channelClass,
      channelId: options?.channelId,
    });
  }

  const resolved = resolveChannel(options);
  if (!resolved.channelId) {
    return { sent: false, via: "none", reason: resolved.reason ?? "channel_not_configured" };
  }

  const config = getDiscordBotConfig();
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
    logDispatch("direct delivery skipped — Discord bot not configured");
  }

  const viaBot = await tryBotDelivery(content, resolved.channelId);
  if (viaBot) return { sent: true, via: "bot" };

  return { sent: false, via: "none", reason: "delivery_failed" };
}

export function getStaffAuditChannelIdForDelivery(): string | null {
  const route = resolveStaffDiscordChannel({ product: "bank", channelClass: "staff_ops" });
  return route.ok ? route.channelId : null;
}

export async function deliverStaffAuditToDiscordChannel(
  content: string,
  channelId?: string,
): Promise<{
  sent: boolean;
  reason?: string;
}> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { sent: false, reason: "disabled_in_test" };
  }

  const resolved = resolveChannel(channelId ? { channelId } : { product: "bank", channelClass: "staff_ops" });
  if (!resolved.channelId) return { sent: false, reason: resolved.reason ?? "channel_not_configured" };

  const config = getDiscordBotConfig();
  if (!config) return { sent: false, reason: "not_configured" };

  try {
    await postChannelTextMessage(config.botToken, resolved.channelId, content);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sent: false, reason: message };
  }
}
