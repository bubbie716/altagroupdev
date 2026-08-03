import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  assertRoleOwnedByBot,
  isDiscordRoleSyncEnabled,
  resolveBankClientRoleId,
  resolveProductRoleConfig,
  resolveSecretaryStaffRoleId,
  resolveTerminalInvestorRoleId,
  roleEventTypeForAction,
} from "./discord-product-role.ts";
import { resolveOutboxTargetBot } from "./discord-event-envelope.ts";
import { resolveDiscordEventDefinition } from "./discord-event-registry.ts";

describe("Discord product role config", () => {
  const keys = [
    "DISCORD_ROLE_SYNC_ENABLED",
    "DISCORD_BANK_CLIENT_ROLE_ID",
    "DISCORD_CLIENT_ROLE_ID",
    "DISCORD_BANK_GUILD_ID",
    "DISCORD_TERMINAL_INVESTOR_ROLE_ID",
    "DISCORD_TERMINAL_GUILD_ID",
    "DISCORD_SECRETARY_STAFF_ROLE_ID",
    "DISCORD_SECRETARY_GUILD_ID",
    "DISCORD_SECRETARY_DELIVERY",
    "DISCORD_TERMINAL_DELIVERY",
  ] as const;
  const original: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key]!;
    }
  });

  function snap(): void {
    for (const key of keys) original[key] = process.env[key];
  }

  it("resolves Bank client role from preferred or legacy env", () => {
    snap();
    delete process.env.DISCORD_BANK_CLIENT_ROLE_ID;
    process.env.DISCORD_CLIENT_ROLE_ID = "legacy-client";
    process.env.DISCORD_BANK_GUILD_ID = "guild-bank";
    assert.equal(resolveBankClientRoleId(), "legacy-client");
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "bank-client";
    assert.equal(resolveBankClientRoleId(), "bank-client");
    const config = resolveProductRoleConfig("bank_client");
    assert.equal(config?.targetBot, "bank");
    assert.equal(config?.roleId, "bank-client");
  });

  it("resolves Terminal investor and Secretary staff roles separately", () => {
    snap();
    process.env.DISCORD_TERMINAL_INVESTOR_ROLE_ID = "inv-1";
    process.env.DISCORD_TERMINAL_GUILD_ID = "guild-term";
    process.env.DISCORD_SECRETARY_STAFF_ROLE_ID = "staff-1";
    process.env.DISCORD_SECRETARY_GUILD_ID = "guild-sec";
    assert.equal(resolveTerminalInvestorRoleId(), "inv-1");
    assert.equal(resolveSecretaryStaffRoleId(), "staff-1");
    assert.equal(resolveProductRoleConfig("terminal_investor")?.targetBot, "terminal");
    assert.equal(resolveProductRoleConfig("secretary_staff")?.targetBot, "secretary");
  });

  it("fails closed when role or guild missing", () => {
    snap();
    delete process.env.DISCORD_BANK_CLIENT_ROLE_ID;
    delete process.env.DISCORD_CLIENT_ROLE_ID;
    delete process.env.DISCORD_BANK_GUILD_ID;
    assert.equal(resolveProductRoleConfig("bank_client"), null);
  });

  it("prevents cross-product ownership", () => {
    snap();
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "c1";
    process.env.DISCORD_BANK_GUILD_ID = "g1";
    assert.equal(assertRoleOwnedByBot("bank_client", "bank").ok, true);
    assert.equal(assertRoleOwnedByBot("bank_client", "terminal").ok, false);
  });

  it("routes role events to owning bots", () => {
    snap();
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "bank",
        channelClass: "role_mgmt",
        eventType: "BANK_CLIENT_ROLE_GRANTED",
      }),
      "bank",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "role_mgmt",
        eventType: "TERMINAL_INVESTOR_ROLE_GRANTED",
      }),
      "terminal",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "secretary",
        channelClass: "role_mgmt",
        eventType: "SECRETARY_STAFF_ROLE_GRANTED",
      }),
      "secretary",
    );
    assert.equal(resolveDiscordEventDefinition("BANK_CLIENT_ROLE_GRANTED").channelClass, "role_mgmt");
    assert.equal(resolveDiscordEventDefinition("TERMINAL_INVESTOR_ROLE_REVOKED").ownedByBot, "terminal");
    assert.equal(roleEventTypeForAction("secretary_staff", "reconcile"), "SECRETARY_STAFF_ROLE_RECONCILED");
  });

  it("role sync flag parses truthy values", () => {
    snap();
    delete process.env.DISCORD_ROLE_SYNC_ENABLED;
    assert.equal(isDiscordRoleSyncEnabled(), false);
    process.env.DISCORD_ROLE_SYNC_ENABLED = "true";
    assert.equal(isDiscordRoleSyncEnabled(), true);
  });
});
