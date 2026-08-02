/**
 * Alta Terminal Discord delivery — Terminal staff/ops only.
 * Never sends customer DMs. Never falls back to Bank or Secretary tokens/channels.
 */

import type { DiscordChannelClass, DiscordProductSource } from "@/lib/discord/discord-event-envelope";
import { isDiscordLiveDeliveryDisabled } from "@/lib/discord/discord-delivery-guard";
import { terminalStaffAuditChannelId } from "@/lib/discord/discord-channel-routing";
import { sanitizeStaffAuditDetails } from "@/lib/staff-audit/staff-audit-privacy";

function logDispatch(message: string, meta?: Record<string, unknown>): void {
  if (isDiscordLiveDeliveryDisabled()) return;
  console.info(`[terminal-dispatch] ${message}`, meta ?? {});
}

export type TerminalBotConfig = {
  botToken: string;
  guildId: string;
  applicationId: string | null;
};

/** Terminal bot credentials — never reuse Bank / Secretary / OAuth client ids. */
export function getTerminalDiscordBotConfig(): TerminalBotConfig | null {
  const botToken = process.env.DISCORD_TERMINAL_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_TERMINAL_GUILD_ID?.trim();
  if (!botToken || !guildId) return null;
  return {
    botToken,
    guildId,
    applicationId: process.env.DISCORD_TERMINAL_APPLICATION_ID?.trim() || null,
  };
}

export function isTerminalDiscordConfigured(): boolean {
  return getTerminalDiscordBotConfig() !== null;
}

function terminalBotInternalUrl(): string {
  return process.env.TERMINAL_BOT_INTERNAL_URL?.trim() || "http://127.0.0.1:3849";
}

function terminalBotApiSecret(): string | null {
  return (
    process.env.TERMINAL_BOT_API_SECRET?.trim() ||
    process.env.BOT_API_SECRET?.trim() ||
    null
  );
}

export type TerminalDispatchOptions = {
  product?: DiscordProductSource;
  channelClass?: DiscordChannelClass;
  channelId?: string;
};

const REJECTED_ROUTE_KEYS = new Set([
  "bank_staff_audit",
  "secretary_staff_audit",
  "security_alert",
  "delivery_failure",
]);

function resolveTerminalChannel(options?: TerminalDispatchOptions): {
  channelId: string | null;
  reason?: string;
  routeKey?: string;
} {
  if (options?.channelId?.trim()) {
    return { channelId: options.channelId.trim(), routeKey: "explicit" };
  }

  const product = options?.product ?? "terminal";
  if (product !== "terminal") {
    return {
      channelId: null,
      reason: "terminal_refuses_non_terminal_product",
      routeKey: "terminal_guard",
    };
  }

  if (options?.channelClass === "customer_dm") {
    return {
      channelId: null,
      reason: "terminal_refuses_customer_dm",
      routeKey: "terminal_guard",
    };
  }

  // Terminal bot posts only to its own staff channel — never Bank/Secretary routes.
  const channel = terminalStaffAuditChannelId();
  if (!channel) {
    return {
      channelId: null,
      reason: "terminal_staff_channel_not_configured",
      routeKey: "terminal_staff_audit",
    };
  }

  const routeKey = "terminal_staff_audit";
  if (REJECTED_ROUTE_KEYS.has(routeKey)) {
    return { channelId: null, reason: "terminal_refuses_foreign_route", routeKey };
  }

  return { channelId: channel, routeKey };
}

function redactTerminalContent(content: string): string {
  const sanitized = sanitizeStaffAuditDetails(content);
  return (sanitized ?? content).slice(0, 2000);
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
    body: JSON.stringify({ content: redactTerminalContent(content) }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DISCORD_API_ERROR:${response.status}:${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { id?: string };
  return data.id ?? "unknown";
}

async function tryTerminalBotDelivery(content: string, channelId: string): Promise<boolean> {
  const secret = terminalBotApiSecret();
  if (!secret) {
    logDispatch("bot delivery skipped — TERMINAL_BOT_API_SECRET/BOT_API_SECRET not set");
    return false;
  }

  try {
    const response = await fetch(`${terminalBotInternalUrl()}/internal/staff-audit/deliver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ content: redactTerminalContent(content), channelId }),
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

export async function dispatchTerminalStaffMessage(
  content: string,
  options?: TerminalDispatchOptions,
): Promise<{ sent: boolean; via: "direct" | "bot" | "none"; reason?: string }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { sent: false, via: "none", reason: "disabled_in_test" };
  }

  const resolved = resolveTerminalChannel(options);
  if (!resolved.channelId) {
    return { sent: false, via: "none", reason: resolved.reason ?? "channel_not_configured" };
  }

  if (resolved.routeKey && REJECTED_ROUTE_KEYS.has(resolved.routeKey)) {
    return { sent: false, via: "none", reason: "terminal_refuses_foreign_route" };
  }

  const config = getTerminalDiscordBotConfig();
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
    logDispatch("direct delivery skipped — Terminal bot not configured");
  }

  const viaBot = await tryTerminalBotDelivery(content, resolved.channelId);
  if (viaBot) return { sent: true, via: "bot" };

  return {
    sent: false,
    via: "none",
    reason: config ? "delivery_failed" : "terminal_bot_not_configured",
  };
}

/** Used by Terminal bot gateway fallback — posts with Terminal token only. */
export async function deliverTerminalStaffToDiscordChannel(
  content: string,
  channelId?: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { sent: false, reason: "disabled_in_test" };
  }

  const resolved = resolveTerminalChannel(
    channelId ? { channelId } : { product: "terminal", channelClass: "staff_ops" },
  );
  if (!resolved.channelId) {
    return { sent: false, reason: resolved.reason ?? "channel_not_configured" };
  }

  const config = getTerminalDiscordBotConfig();
  if (!config) return { sent: false, reason: "terminal_bot_not_configured" };

  try {
    await postChannelTextMessage(config.botToken, resolved.channelId, content);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { sent: false, reason: message };
  }
}

/** Test/ops helper — expose channel resolution without sending. */
export function resolveTerminalDispatchChannelForTests(
  options?: TerminalDispatchOptions,
): { channelId: string | null; reason?: string; routeKey?: string } {
  return resolveTerminalChannel(options);
}
