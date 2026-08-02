import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  deliverDiscordOutboxPayload,
  enqueueDiscordOutboxEvent,
  isDiscordOutboxDualWriteEnabled,
} from "./discord-outbox.service.ts";

describe("discord outbox dual-write flag", () => {
  const original = process.env.DISCORD_OUTBOX_DUAL_WRITE;

  afterEach(() => {
    if (original === undefined) delete process.env.DISCORD_OUTBOX_DUAL_WRITE;
    else process.env.DISCORD_OUTBOX_DUAL_WRITE = original;
  });

  it("is disabled unless explicitly enabled", () => {
    delete process.env.DISCORD_OUTBOX_DUAL_WRITE;
    assert.equal(isDiscordOutboxDualWriteEnabled(), false);
    process.env.DISCORD_OUTBOX_DUAL_WRITE = "false";
    assert.equal(isDiscordOutboxDualWriteEnabled(), false);
  });

  it("enables for true / 1 / yes", () => {
    process.env.DISCORD_OUTBOX_DUAL_WRITE = "true";
    assert.equal(isDiscordOutboxDualWriteEnabled(), true);
    process.env.DISCORD_OUTBOX_DUAL_WRITE = "1";
    assert.equal(isDiscordOutboxDualWriteEnabled(), true);
    process.env.DISCORD_OUTBOX_DUAL_WRITE = "yes";
    assert.equal(isDiscordOutboxDualWriteEnabled(), true);
  });

  it("enqueue is a no-op when dual-write is off (no DB write)", async () => {
    delete process.env.DISCORD_OUTBOX_DUAL_WRITE;
    const id = await enqueueDiscordOutboxEvent({
      envelope: {
        idempotencyKey: "test-noop-key",
        product: "bank",
        eventType: "TRANSFER_COMPLETED",
        targetBot: "bank",
        channelClass: "customer_dm",
        displayPayload: {
          kind: "customer_dm",
          userId: "u1",
          title: "Transfer",
          body: "Done",
        },
      },
    });
    assert.equal(id, null);
  });
});

describe("discord outbox Bank pipeline delivery (mocked REST)", () => {
  it("delivers customer_dm via injected Bank dispatch (no live Discord)", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const result = await deliverDiscordOutboxPayload(
      {
        kind: "customer_dm",
        userId: "user-1",
        title: "Crypto fill",
        body: "Order filled",
        linkUrl: "/terminal",
        linkLabel: "View",
        notificationId: "notif-1",
      },
      {
        dispatchCustomerDm: async (input) => {
          calls.push(input);
          return { sent: true };
        },
        dispatchStaffAudit: async () => {
          throw new Error("should not call staff audit");
        },
      },
    );

    assert.equal(result.sent, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.userId, "user-1");
    assert.equal(calls[0]?.title, "Crypto fill");
  });

  it("delivers staff_audit via injected Bank dispatch (no live Discord)", async () => {
    const contents: string[] = [];
    const result = await deliverDiscordOutboxPayload(
      {
        kind: "staff_audit",
        content: "[INFO] [Alta Terminal] Crypto order filled — System",
        product: "Alta Terminal",
        action: "Crypto order filled",
      },
      {
        dispatchCustomerDm: async () => {
          throw new Error("should not call customer dm");
        },
        dispatchStaffAudit: async (content) => {
          contents.push(content);
          return { sent: true };
        },
      },
    );

    assert.equal(result.sent, true);
    assert.equal(contents.length, 1);
    assert.match(contents[0]!, /Alta Terminal/);
  });

  it("propagates delivery failure reasons without throwing", async () => {
    const result = await deliverDiscordOutboxPayload(
      {
        kind: "customer_dm",
        userId: "user-2",
        title: "Fail",
        body: "Nope",
      },
      {
        dispatchCustomerDm: async () => ({ sent: false, reason: "not_configured" }),
        dispatchStaffAudit: async () => ({ sent: false }),
      },
    );
    assert.equal(result.sent, false);
    assert.equal(result.reason, "not_configured");
  });
});

describe("discord outbox env isolation", () => {
  beforeEach(() => {
    // Ensure unit suite never enables dual-write accidentally against a real DB.
    delete process.env.DISCORD_OUTBOX_DUAL_WRITE;
  });

  it("keeps dual-write off by default in this suite", () => {
    assert.equal(isDiscordOutboxDualWriteEnabled(), false);
  });
});
