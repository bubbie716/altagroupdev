/**
 * Shared Discord product role keys + config resolution (Phase 5).
 * Role IDs are authority — never resolve by Discord role name.
 */

import type { DiscordProductSource, DiscordTargetBot } from "@/lib/discord/discord-event-envelope";

export type DiscordProductRoleKey = "bank_client" | "terminal_investor" | "secretary_staff";

export type DiscordRoleAction = "grant" | "revoke" | "reconcile";

export type DiscordProductRoleConfig = {
  productRole: DiscordProductRoleKey;
  product: DiscordProductSource;
  targetBot: DiscordTargetBot;
  roleId: string;
  guildId: string;
  botTokenEnv: string;
  label: string;
};

function truthy(raw: string | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/** Master switch for grant/revoke/reconcile workers. Legacy grant-only path may still run when off. */
export function isDiscordRoleSyncEnabled(): boolean {
  return truthy(process.env.DISCORD_ROLE_SYNC_ENABLED);
}

/** Prefer DISCORD_BANK_CLIENT_ROLE_ID; keep DISCORD_CLIENT_ROLE_ID as legacy alias. */
export function resolveBankClientRoleId(): string | null {
  return (
    process.env.DISCORD_BANK_CLIENT_ROLE_ID?.trim() ||
    process.env.DISCORD_CLIENT_ROLE_ID?.trim() ||
    null
  );
}

export function resolveTerminalInvestorRoleId(): string | null {
  return process.env.DISCORD_TERMINAL_INVESTOR_ROLE_ID?.trim() || null;
}

/** Secretary-managed staff Discord role (maps from UserTag admin tags). */
export function resolveSecretaryStaffRoleId(): string | null {
  return process.env.DISCORD_SECRETARY_STAFF_ROLE_ID?.trim() || null;
}

export function resolveProductRoleConfig(
  productRole: DiscordProductRoleKey,
): DiscordProductRoleConfig | null {
  if (productRole === "bank_client") {
    const roleId = resolveBankClientRoleId();
    const guildId = process.env.DISCORD_BANK_GUILD_ID?.trim();
    if (!roleId || !guildId) return null;
    return {
      productRole,
      product: "bank",
      targetBot: "bank",
      roleId,
      guildId,
      botTokenEnv: "DISCORD_BANK_BOT_TOKEN",
      label: "Client",
    };
  }

  if (productRole === "terminal_investor") {
    const roleId = resolveTerminalInvestorRoleId();
    const guildId = process.env.DISCORD_TERMINAL_GUILD_ID?.trim();
    if (!roleId || !guildId) return null;
    return {
      productRole,
      product: "terminal",
      targetBot: "terminal",
      roleId,
      guildId,
      botTokenEnv: "DISCORD_TERMINAL_BOT_TOKEN",
      label: "Investor",
    };
  }

  const roleId = resolveSecretaryStaffRoleId();
  const guildId = process.env.DISCORD_SECRETARY_GUILD_ID?.trim();
  if (!roleId || !guildId) return null;
  return {
    productRole: "secretary_staff",
    product: "secretary",
    targetBot: "secretary",
    roleId,
    guildId,
    botTokenEnv: "DISCORD_SECRETARY_BOT_TOKEN",
    label: "Staff",
  };
}

export function botTokenForProductRole(config: DiscordProductRoleConfig): string | null {
  const token = process.env[config.botTokenEnv]?.trim();
  if (token) return token;
  // Secretary legacy alias only for secretary_staff.
  if (config.productRole === "secretary_staff") {
    return process.env.DISCORD_CORPORATE_BOT_TOKEN?.trim() || null;
  }
  return null;
}

export function roleEventTypeForAction(
  productRole: DiscordProductRoleKey,
  action: DiscordRoleAction,
): string {
  const prefix =
    productRole === "bank_client"
      ? "BANK_CLIENT_ROLE"
      : productRole === "terminal_investor"
        ? "TERMINAL_INVESTOR_ROLE"
        : "SECRETARY_STAFF_ROLE";
  const suffix =
    action === "grant" ? "GRANTED" : action === "revoke" ? "REVOKED" : "RECONCILED";
  return `${prefix}_${suffix}`;
}

export function assertRoleOwnedByBot(
  productRole: DiscordProductRoleKey,
  targetBot: DiscordTargetBot,
): { ok: true } | { ok: false; reason: string } {
  const config = resolveProductRoleConfig(productRole);
  if (!config) return { ok: false, reason: "role_not_configured" };
  if (config.targetBot !== targetBot) {
    return { ok: false, reason: "cross_product_role_refused" };
  }
  return { ok: true };
}
