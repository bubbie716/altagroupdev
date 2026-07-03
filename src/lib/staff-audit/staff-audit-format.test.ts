import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  buildStaffAuditViewLink,
  formatStaffAuditAction,
  formatStaffAuditMessage,
} from "./staff-audit-format.ts";
import { maskAccountNumber, sanitizeStaffAuditDetails } from "./staff-audit-privacy.ts";
import { internalTransactionUrl } from "./staff-audit-internal-urls.ts";
import {
  resetStaffAuditDedupeCacheForTests,
  sendStaffAuditMessageAsync,
} from "@/server/staff-audit-notification.service.ts";

describe("staff audit formatting", () => {
  const originalBaseUrl = process.env.ALTA_WEB_BASE_URL;
  const originalChannelId = process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
  const originalBotToken = process.env.DISCORD_BOT_TOKEN;
  const originalGuildId = process.env.DISCORD_GUILD_ID;

  beforeEach(() => {
    process.env.ALTA_WEB_BASE_URL = "https://bank.alta.example";
    delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    delete process.env.DISCORD_BOT_TOKEN;
    delete process.env.DISCORD_GUILD_ID;
    resetStaffAuditDedupeCacheForTests();
  });

  afterEach(() => {
    if (originalBaseUrl === undefined) delete process.env.ALTA_WEB_BASE_URL;
    else process.env.ALTA_WEB_BASE_URL = originalBaseUrl;
    if (originalChannelId === undefined) delete process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID;
    else process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = originalChannelId;
    if (originalBotToken === undefined) delete process.env.DISCORD_BOT_TOKEN;
    else process.env.DISCORD_BOT_TOKEN = originalBotToken;
    if (originalGuildId === undefined) delete process.env.DISCORD_GUILD_ID;
    else process.env.DISCORD_GUILD_ID = originalGuildId;
    resetStaffAuditDedupeCacheForTests();
  });

  it("formats plain text with severity, product, actor, details, and view link", () => {
    const message = formatStaffAuditMessage({
      product: "Alta Bank",
      action: "Deposit request submitted",
      actorLabel: "Carter Townshend",
      details: "ƒ25,000.00 · Ref DEP-123",
      internalUrl: internalTransactionUrl("txn-123"),
      severity: "ACTION",
    });

    assert.match(message, /^\[ACTION\] \[Alta Bank\] Deposit request submitted — Carter Townshend/);
    assert.match(message, /View: https:\/\/bank\.alta\.example\/internal\/bank\/transactions\/txn-123$/);
  });

  it("labels Discord bot source on the action", () => {
    const action = formatStaffAuditAction("Deposit request submitted", "discord_bot");
    assert.equal(action, "Deposit request submitted via Discord");
  });

  it("builds internal links from ALTA_WEB_BASE_URL", () => {
    assert.equal(
      buildStaffAuditViewLink("/internal/settings"),
      "https://bank.alta.example/internal/settings",
    );
  });

  it("masks account numbers in details", () => {
    const sanitized = sanitizeStaffAuditDetails("From AB-1234-567890 to merchant");
    assert.equal(sanitized, "From AB-1234-**90 to merchant");
  });

  it("skips Discord delivery safely when channel is not configured", async () => {
    const result = await sendStaffAuditMessageAsync({
      product: "Alta Bank",
      action: "Transfer completed",
      actorName: "Carter Townshend",
      details: "ƒ100.00",
      internalUrl: "/internal/bank/transfers",
      severity: "INFO",
    });

    assert.equal(result.sent, false);
    assert.equal(result.reason, "channel_not_configured");
  });

  it("deduplicates repeated messages within the TTL window", async () => {
    process.env.DISCORD_STAFF_AUDIT_CHANNEL_ID = "123456789012345678";

    const input = {
      product: "Alta Pay" as const,
      action: "Payment sent",
      actorName: "Carter Townshend",
      dedupeKey: "alta-pay-sent:REF-1",
      severity: "INFO" as const,
    };

    const first = await sendStaffAuditMessageAsync(input);
    const second = await sendStaffAuditMessageAsync(input);

    assert.equal(first.sent, false);
    assert.equal(second.sent, false);
    assert.equal(second.reason, "duplicate");
  });
});
