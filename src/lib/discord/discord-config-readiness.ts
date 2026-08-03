/**
 * Phase 8 — Discord bot/channel configuration readiness (no secret values exposed).
 */

import {
  bankStaffAuditChannelId,
  deliveryFailureChannelId,
  secretaryStaffAuditChannelId,
  securityAlertChannelId,
  terminalStaffAuditChannelId,
} from "@/lib/discord/discord-channel-routing";
import {
  isDiscordSecretaryAuditFanoutEnabled,
} from "@/lib/discord/discord-secretary-audit-fanout";
import {
  isDiscordSecretaryDeliveryEnabled,
  isDiscordTerminalDeliveryEnabled,
} from "@/lib/discord/discord-event-envelope";
import { isDiscordProductAwareRoutingEnabled } from "@/lib/discord/discord-event-registry";
import { isDiscordProductPremiumEmbedsEnabled } from "@/lib/discord/discord-product-notification-templates";
import type { DiscordTargetBot } from "@/lib/discord/discord-event-envelope";

export type DiscordReadinessState =
  | "available"
  | "disabled"
  | "not_configured"
  | "blocked";

export type DiscordBotReadiness = {
  bot: DiscordTargetBot;
  productLabel: string;
  state: DiscordReadinessState;
  deliveryEnabled: boolean;
  reasons: string[];
  channels: {
    staffAudit: boolean;
    securityAlert?: boolean;
    deliveryFailure?: boolean;
  };
};

export type DiscordPlatformReadiness = {
  productAwareRouting: boolean;
  outboxDualWrite: boolean;
  secretaryAuditFanout: boolean;
  productPremiumEmbeds: boolean;
  roleSyncEnabled: boolean;
  bots: DiscordBotReadiness[];
  crossRoutingWarnings: string[];
};

function envPresent(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function isRoleSyncEnabled(): boolean {
  const raw = process.env.DISCORD_ROLE_SYNC_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function isOutboxDualWriteEnabled(): boolean {
  const raw = process.env.DISCORD_OUTBOX_DUAL_WRITE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function bankBotConfigured(): boolean {
  return envPresent("DISCORD_BANK_BOT_TOKEN") || envPresent("DISCORD_BOT_TOKEN");
}

function secretaryBotConfigured(): boolean {
  return (
    (envPresent("DISCORD_SECRETARY_BOT_TOKEN") || envPresent("DISCORD_CORPORATE_BOT_TOKEN")) &&
    envPresent("DISCORD_SECRETARY_GUILD_ID")
  );
}

function terminalBotConfigured(): boolean {
  return envPresent("DISCORD_TERMINAL_BOT_TOKEN") && envPresent("DISCORD_TERMINAL_GUILD_ID");
}

function readinessForBot(input: {
  bot: DiscordTargetBot;
  productLabel: string;
  configured: boolean;
  deliveryEnabled: boolean;
  staffChannel: boolean;
  securityAlert?: boolean;
  deliveryFailure?: boolean;
  blockedReasons?: string[];
}): DiscordBotReadiness {
  const reasons: string[] = [...(input.blockedReasons ?? [])];
  if (!input.configured) reasons.push("bot_credentials_missing");
  if (input.deliveryEnabled && !input.staffChannel && input.bot !== "bank") {
    // Bank may use legacy single staff channel; Terminal/Secretary fail closed without channel.
    reasons.push("staff_audit_channel_missing");
  }
  if (input.bot === "bank" && !input.staffChannel) {
    reasons.push("bank_staff_audit_channel_missing");
  }

  let state: DiscordReadinessState = "available";
  if (!input.deliveryEnabled && input.bot !== "bank") {
    state = "disabled";
  } else if (!input.configured) {
    state = "not_configured";
  } else if (reasons.includes("staff_audit_channel_missing") || reasons.includes("bank_staff_audit_channel_missing")) {
    state = input.deliveryEnabled || input.bot === "bank" ? "blocked" : "not_configured";
  } else if (input.blockedReasons?.length) {
    state = "blocked";
  }

  return {
    bot: input.bot,
    productLabel: input.productLabel,
    state,
    deliveryEnabled: input.deliveryEnabled,
    reasons: [...new Set(reasons)],
    channels: {
      staffAudit: input.staffChannel,
      securityAlert: input.securityAlert,
      deliveryFailure: input.deliveryFailure,
    },
  };
}

/** Safe configuration snapshot — never includes token values. */
export function getDiscordPlatformReadiness(): DiscordPlatformReadiness {
  const bankChannel = Boolean(bankStaffAuditChannelId());
  const secretaryChannel = Boolean(secretaryStaffAuditChannelId());
  const terminalChannel = Boolean(terminalStaffAuditChannelId());
  const security = Boolean(securityAlertChannelId());
  const delivery = Boolean(deliveryFailureChannelId());

  const crossRoutingWarnings: string[] = [];
  const bankId = bankStaffAuditChannelId();
  const secId = secretaryStaffAuditChannelId();
  const termId = terminalStaffAuditChannelId();
  if (bankId && secId && bankId === secId) {
    crossRoutingWarnings.push("bank_staff_channel_matches_secretary_staff_channel");
  }
  if (bankId && termId && bankId === termId) {
    crossRoutingWarnings.push("bank_staff_channel_matches_terminal_staff_channel");
  }
  if (secId && termId && secId === termId) {
    crossRoutingWarnings.push("secretary_staff_channel_matches_terminal_staff_channel");
  }

  const bots: DiscordBotReadiness[] = [
    readinessForBot({
      bot: "bank",
      productLabel: "Alta Bank",
      configured: bankBotConfigured(),
      deliveryEnabled: true,
      staffChannel: bankChannel,
    }),
    readinessForBot({
      bot: "secretary",
      productLabel: "Alta Secretary",
      configured: secretaryBotConfigured(),
      deliveryEnabled: isDiscordSecretaryDeliveryEnabled(),
      staffChannel: secretaryChannel,
      securityAlert: security || secretaryChannel,
      deliveryFailure: delivery || secretaryChannel,
      blockedReasons:
        isDiscordSecretaryAuditFanoutEnabled() && !secretaryBotConfigured()
          ? ["fanout_enabled_but_secretary_unconfigured"]
          : [],
    }),
    readinessForBot({
      bot: "terminal",
      productLabel: "Alta Terminal",
      configured: terminalBotConfigured(),
      deliveryEnabled: isDiscordTerminalDeliveryEnabled(),
      staffChannel: terminalChannel,
      blockedReasons:
        isDiscordTerminalDeliveryEnabled() && !terminalChannel
          ? ["terminal_delivery_enabled_without_staff_channel"]
          : [],
    }),
  ];

  return {
    productAwareRouting: isDiscordProductAwareRoutingEnabled(),
    outboxDualWrite: isOutboxDualWriteEnabled(),
    secretaryAuditFanout: isDiscordSecretaryAuditFanoutEnabled(),
    productPremiumEmbeds: isDiscordProductPremiumEmbedsEnabled(),
    roleSyncEnabled: isRoleSyncEnabled(),
    bots,
    crossRoutingWarnings,
  };
}

/** Never report healthy when state is blocked/not_configured. */
export function isBotReadinessHealthy(bot: DiscordBotReadiness): boolean {
  return bot.state === "available" || (bot.bot !== "bank" && bot.state === "disabled");
}
