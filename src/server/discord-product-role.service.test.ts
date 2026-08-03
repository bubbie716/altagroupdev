import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { applyDiscordProductRole } from "./discord-product-role.service.ts";

describe("applyDiscordProductRole network safety + ownership", () => {
  const keys = [
    "DISCORD_BANK_CLIENT_ROLE_ID",
    "DISCORD_CLIENT_ROLE_ID",
    "DISCORD_BANK_GUILD_ID",
    "DISCORD_BANK_BOT_TOKEN",
    "DISCORD_TERMINAL_INVESTOR_ROLE_ID",
    "DISCORD_TERMINAL_GUILD_ID",
    "DISCORD_TERMINAL_BOT_TOKEN",
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

  it("does not call Discord network in test mode even with credentials", async () => {
    snap();
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "role-1";
    process.env.DISCORD_BANK_GUILD_ID = "guild-1";
    process.env.DISCORD_BANK_BOT_TOKEN = "Bot.fake.token";

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("network should not be reached");
    }) as typeof fetch;

    try {
      const result = await applyDiscordProductRole({
        productRole: "bank_client",
        action: "grant",
        discordUserId: "user-1",
        requiredTargetBot: "bank",
        skipEligibilityCheck: true,
      });
      assert.equal(result.ok, false);
      assert.equal(result.reason, "disabled_in_test");
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("refuses Terminal worker applying Bank client role", async () => {
    snap();
    process.env.DISCORD_BANK_CLIENT_ROLE_ID = "role-1";
    process.env.DISCORD_BANK_GUILD_ID = "guild-1";
    process.env.DISCORD_BANK_BOT_TOKEN = "Bot.fake.token";
    const result = await applyDiscordProductRole({
      productRole: "bank_client",
      action: "grant",
      discordUserId: "user-1",
      requiredTargetBot: "terminal",
      skipEligibilityCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "cross_product_role_refused");
  });

  it("fails closed when role/guild missing", async () => {
    snap();
    delete process.env.DISCORD_BANK_CLIENT_ROLE_ID;
    delete process.env.DISCORD_CLIENT_ROLE_ID;
    delete process.env.DISCORD_BANK_GUILD_ID;
    const result = await applyDiscordProductRole({
      productRole: "bank_client",
      action: "grant",
      discordUserId: "user-1",
      skipEligibilityCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "role_or_guild_not_configured");
  });
});
