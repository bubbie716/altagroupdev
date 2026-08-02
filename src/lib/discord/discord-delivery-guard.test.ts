import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDiscordTestModeSafeForRuntime,
  forceDisableDiscordLiveDelivery,
  isDiscordLiveDeliveryDisabled,
  isDiscordTestModeFlag,
  isDiscordTestRuntime,
  isNodeTestContextEnv,
  isNodeTestRunnerArgv,
} from "./discord-delivery-guard.ts";

describe("discord delivery guard", () => {
  it("detects node/tsx --test argv without NODE_ENV", () => {
    assert.equal(isNodeTestRunnerArgv(["node", "--test", "foo.test.ts"], []), true);
    assert.equal(isNodeTestRunnerArgv(["tsx", "src/foo.ts"], []), false);
    assert.equal(isNodeTestRunnerArgv(["node", "app.js"], ["--test"]), true);
    assert.equal(
      isNodeTestRunnerArgv(["node", "foo.test.ts"], ["--test-isolation=process"]),
      true,
    );
  });

  it("detects NODE_TEST_CONTEXT set by the Node test runner", () => {
    assert.equal(isNodeTestContextEnv({ NODE_TEST_CONTEXT: "child-v8" }), true);
    assert.equal(isNodeTestContextEnv({}), false);
  });

  it("is disabled under the current test runner even without relying on NODE_ENV alone", () => {
    // This file is executed via tsx --test, so delivery must be disabled.
    assert.equal(Boolean(process.env.NODE_TEST_CONTEXT), true);
    assert.equal(isDiscordTestRuntime(), true);
    assert.equal(isDiscordLiveDeliveryDisabled(), true);
  });

  it("forceDisableDiscordLiveDelivery is idempotent and sets env markers", () => {
    forceDisableDiscordLiveDelivery();
    forceDisableDiscordLiveDelivery();
    assert.equal(process.env.DISCORD_LIVE_DELIVERY_DISABLED, "1");
    assert.equal(process.env.STAFF_AUDIT_DISCORD_DISABLED, "1");
    assert.equal(process.env.DISCORD_TEST_MODE, "1");
    assert.equal(isDiscordLiveDeliveryDisabled(), true);
  });

  it("treats DISCORD_TEST_MODE as an explicit test-only disable", () => {
    assert.equal(isDiscordTestModeFlag({ DISCORD_TEST_MODE: "1" }), true);
    assert.equal(isDiscordTestModeFlag({ DISCORD_TEST_MODE: "true" }), true);
    assert.equal(isDiscordTestModeFlag({}), false);
  });

  it("production fails closed when DISCORD_TEST_MODE is set", () => {
    assert.throws(
      () =>
        assertDiscordTestModeSafeForRuntime({
          NODE_ENV: "production",
          DISCORD_TEST_MODE: "1",
        }),
      /DISCORD_TEST_MODE must not be set/,
    );
  });

  it("real Discord credentials cannot cause a network delivery during tests", async () => {
    // Even with plausible-looking tokens present, dispatch helpers must short-circuit.
    const prevBank = process.env.DISCORD_BANK_BOT_TOKEN;
    const prevTerm = process.env.DISCORD_TERMINAL_BOT_TOKEN;
    const prevSec = process.env.DISCORD_SECRETARY_BOT_TOKEN;
    process.env.DISCORD_BANK_BOT_TOKEN = "Bot.fake.token.for.regression";
    process.env.DISCORD_TERMINAL_BOT_TOKEN = "Bot.fake.terminal.token";
    process.env.DISCORD_SECRETARY_BOT_TOKEN = "Bot.fake.secretary.token";
    process.env.DISCORD_TERMINAL_GUILD_ID = "guild-test";
    process.env.DISCORD_TERMINAL_STAFF_AUDIT_CHANNEL_ID = "channel-test";

    let fetchCalled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      throw new Error("network should not be reached in test mode");
    }) as typeof fetch;

    try {
      assert.equal(isDiscordLiveDeliveryDisabled(), true);
      const { dispatchTerminalStaffMessage } = await import(
        "../../server/terminal-discord-dispatch.service.ts"
      );
      const { dispatchSecretaryStaffMessage } = await import(
        "../../server/secretary-discord-dispatch.service.ts"
      );
      const { dispatchStaffAuditDiscordMessage } = await import(
        "../../server/staff-audit-discord-dispatch.service.ts"
      );

      const terminal = await dispatchTerminalStaffMessage("test", {
        product: "terminal",
        channelClass: "staff_ops",
      });
      const secretary = await dispatchSecretaryStaffMessage("test", {
        product: "ops",
        channelClass: "staff_ops",
      });
      const bankStaff = await dispatchStaffAuditDiscordMessage("test", {
        product: "bank",
        channelClass: "staff_ops",
      });

      assert.equal(terminal.sent, false);
      assert.equal(terminal.reason, "disabled_in_test");
      assert.equal(secretary.sent, false);
      assert.equal(bankStaff.sent, false);
      assert.equal(fetchCalled, false);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevBank === undefined) delete process.env.DISCORD_BANK_BOT_TOKEN;
      else process.env.DISCORD_BANK_BOT_TOKEN = prevBank;
      if (prevTerm === undefined) delete process.env.DISCORD_TERMINAL_BOT_TOKEN;
      else process.env.DISCORD_TERMINAL_BOT_TOKEN = prevTerm;
      if (prevSec === undefined) delete process.env.DISCORD_SECRETARY_BOT_TOKEN;
      else process.env.DISCORD_SECRETARY_BOT_TOKEN = prevSec;
    }
  });
});
