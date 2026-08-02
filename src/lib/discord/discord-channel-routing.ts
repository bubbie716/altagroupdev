/**
 * Product-aware Discord channel routing (Phase 2/3/4).
 * Channels are selected by product/channel class.
 * Terminal/Secretary channels never fall back to the Bank staff channel when
 * product-aware routing is enabled. Secretary/Terminal delivery never uses customer DMs.
 */

import type { DiscordChannelClass, DiscordProductSource } from "@/lib/discord/discord-event-envelope";
import { isDiscordProductAwareRoutingEnabled } from "@/lib/discord/discord-event-registry";

export type DiscordChannelRouteResult =
  | { ok: true; channelId: string; routeKey: string }
  | { ok: false; reason: string; routeKey: string };

function readEnvChannel(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

/** Bank staff audit (legacy default). */
export function bankStaffAuditChannelId(): string | null {
  return readEnvChannel("DISCORD_STAFF_AUDIT_CHANNEL_ID");
}

export function terminalStaffAuditChannelId(): string | null {
  return readEnvChannel("DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID");
}

export function secretaryStaffAuditChannelId(): string | null {
  return readEnvChannel("DISCORD_SECRETARY_STAFF_AUDIT_CHANNEL_ID");
}

export function securityAlertChannelId(): string | null {
  return readEnvChannel("DISCORD_SECURITY_ALERT_CHANNEL_ID");
}

export function deliveryFailureChannelId(): string | null {
  return readEnvChannel("DISCORD_DELIVERY_FAILURE_CHANNEL_ID");
}

/**
 * Resolve the Discord channel for a staff/security/delivery message.
 * Customer DMs do not use this (they are user DMs, not guild channels).
 */
export function resolveStaffDiscordChannel(input: {
  product: DiscordProductSource;
  channelClass: DiscordChannelClass;
}): DiscordChannelRouteResult {
  const productAware = isDiscordProductAwareRoutingEnabled();

  if (!productAware) {
    const bank = bankStaffAuditChannelId();
    if (!bank) {
      return { ok: false, reason: "channel_not_configured", routeKey: "bank_staff_audit" };
    }
    return { ok: true, channelId: bank, routeKey: "bank_staff_audit" };
  }

  if (input.channelClass === "delivery_alert") {
    const channel = deliveryFailureChannelId() ?? secretaryStaffAuditChannelId();
    if (!channel) {
      return {
        ok: false,
        reason: "delivery_failure_channel_not_configured",
        routeKey: "delivery_failure",
      };
    }
    return { ok: true, channelId: channel, routeKey: "delivery_failure" };
  }

  if (input.channelClass === "security_audit") {
    const channel = securityAlertChannelId() ?? secretaryStaffAuditChannelId();
    if (!channel) {
      return {
        ok: false,
        reason: "security_alert_channel_not_configured",
        routeKey: "security_alert",
      };
    }
    return { ok: true, channelId: channel, routeKey: "security_alert" };
  }

  // staff_ops / role_mgmt by product
  if (input.product === "terminal") {
    const channel = terminalStaffAuditChannelId();
    if (!channel) {
      return {
        ok: false,
        reason: "terminal_staff_channel_not_configured",
        routeKey: "terminal_staff_audit",
      };
    }
    return { ok: true, channelId: channel, routeKey: "terminal_staff_audit" };
  }

  if (input.product === "secretary" || input.product === "ops" || input.product === "corporate") {
    const channel = secretaryStaffAuditChannelId();
    if (!channel) {
      return {
        ok: false,
        reason: "secretary_staff_channel_not_configured",
        routeKey: "secretary_staff_audit",
      };
    }
    return { ok: true, channelId: channel, routeKey: "secretary_staff_audit" };
  }

  const bank = bankStaffAuditChannelId();
  if (!bank) {
    return { ok: false, reason: "channel_not_configured", routeKey: "bank_staff_audit" };
  }
  return { ok: true, channelId: bank, routeKey: "bank_staff_audit" };
}
