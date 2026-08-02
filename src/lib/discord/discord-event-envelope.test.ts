import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildCustomerDmIdempotencyKey,
  buildStaffAuditIdempotencyKey,
  isDiscordSecretaryDeliveryEnabled,
  isDiscordTerminalDeliveryEnabled,
  resolveDiscordProductSource,
  resolveOutboxTargetBot,
  resolvePhase1TargetBot,
  resolvePhase2DeliveryBot,
  staffAuditProductToSource,
} from "./discord-event-envelope.ts";

describe("discord event envelope", () => {
  const originalSecretary = process.env.DISCORD_SECRETARY_DELIVERY;
  const originalTerminal = process.env.DISCORD_TERMINAL_DELIVERY;

  afterEach(() => {
    if (originalSecretary === undefined) delete process.env.DISCORD_SECRETARY_DELIVERY;
    else process.env.DISCORD_SECRETARY_DELIVERY = originalSecretary;
    if (originalTerminal === undefined) delete process.env.DISCORD_TERMINAL_DELIVERY;
    else process.env.DISCORD_TERMINAL_DELIVERY = originalTerminal;
  });

  it("maps TERMINAL_* notification types to terminal product", () => {
    assert.equal(resolveDiscordProductSource("TERMINAL_CRYPTO_ORDER_FILLED"), "terminal");
    assert.equal(resolveDiscordProductSource("TERMINAL_SCHEDULED_TRADE_CREATED"), "terminal");
  });

  it("maps bank and ops types", () => {
    assert.equal(resolveDiscordProductSource("TRANSFER_COMPLETED"), "bank");
    assert.equal(resolveDiscordProductSource("OPS_JOB_FAILED"), "ops");
    assert.equal(resolveDiscordProductSource("COMPANY_VERIFIED"), "corporate");
  });

  it("phase 1/2 always targets the Bank bot", () => {
    assert.equal(resolvePhase1TargetBot("terminal"), "bank");
    assert.equal(resolvePhase1TargetBot("secretary"), "bank");
    assert.equal(resolvePhase1TargetBot("bank"), "bank");
    assert.equal(resolvePhase2DeliveryBot("ops"), "bank");
  });

  it("phase 3 routes secretary staff when DISCORD_SECRETARY_DELIVERY is on", () => {
    delete process.env.DISCORD_SECRETARY_DELIVERY;
    assert.equal(isDiscordSecretaryDeliveryEnabled(), false);
    process.env.DISCORD_SECRETARY_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "ops",
        channelClass: "staff_ops",
        eventType: "OPS_JOB_FAILED",
      }),
      "secretary",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "corporate",
        channelClass: "customer_dm",
        eventType: "COMPANY_VERIFIED",
      }),
      "bank",
    );
  });

  it("phase 4 routes Terminal staff when DISCORD_TERMINAL_DELIVERY is on", () => {
    delete process.env.DISCORD_TERMINAL_DELIVERY;
    assert.equal(isDiscordTerminalDeliveryEnabled(), false);
    process.env.DISCORD_TERMINAL_DELIVERY = "true";
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "staff_ops",
        eventType: "TERMINAL_CRYPTO_FEE_CONFIG_UPDATED",
      }),
      "terminal",
    );
    assert.equal(
      resolveOutboxTargetBot({
        product: "terminal",
        channelClass: "customer_dm",
        eventType: "TERMINAL_CRYPTO_ORDER_FILLED",
      }),
      "bank",
    );
  });

  it("maps staff audit product labels to sources", () => {
    assert.equal(staffAuditProductToSource("Alta Terminal"), "terminal");
    assert.equal(staffAuditProductToSource("Alta Ops"), "ops");
    assert.equal(staffAuditProductToSource("Companies"), "corporate");
    assert.equal(staffAuditProductToSource("Alta Bank"), "bank");
  });

  it("builds stable idempotency keys", () => {
    assert.equal(
      buildCustomerDmIdempotencyKey({
        userId: "u1",
        type: "TRANSFER_COMPLETED",
        notificationId: "n1",
      }),
      "customer-dm:u1:TRANSFER_COMPLETED:n1",
    );
    assert.equal(
      buildStaffAuditIdempotencyKey("audit-log:FOO:bar", "fallback"),
      "staff-audit:audit-log:FOO:bar",
    );
    assert.equal(
      buildStaffAuditIdempotencyKey("staff-audit:already", "fallback"),
      "staff-audit:already",
    );
  });
});
