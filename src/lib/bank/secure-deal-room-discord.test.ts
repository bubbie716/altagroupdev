import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  buildStaffDealRoomDmBody,
  sanitizeDiscordReplyContent,
} from "@/lib/bank/secure-deal-room-discord-copy";
import {
  resolveCustomerDealRoomUrl,
  resolveSessionForReply,
  resetPendingDiscordRepliesForTests,
  stashPendingDiscordReply,
} from "@/server/secure-deal-room-discord.service";
import { sourceLabel } from "@/lib/bank/secure-deal-room-discord-types";

describe("secure deal room discord copy", () => {
  it("builds staff DM body with sender preview and reply instructions", () => {
    const body = buildStaffDealRoomDmBody({
      dealRoomType: "LOAN_APPLICATION",
      staffDisplayName: "Alta Credit Desk",
      messageBody: "Can you provide proof of income?",
    });

    assert.match(body, /Loan Application/);
    assert.match(body, /Alta Credit Desk/);
    assert.match(body, /proof of income/);
    assert.match(body, /reply directly to this message/i);
  });

  it("sanitizes and caps discord reply content", () => {
    assert.equal(sanitizeDiscordReplyContent("  hello  "), "hello");
    assert.equal(sanitizeDiscordReplyContent("   "), null);
    assert.equal(sanitizeDiscordReplyContent("x".repeat(5000))?.length, 4000);
  });
});

describe("secure deal room session resolution", () => {
  const baseSession = {
    id: "sess-1",
    dealRoomType: "LOAN_APPLICATION" as const,
    dealRoomId: "app-1",
    threadId: "thread-1",
    userId: "user-1",
    discordUserId: "discord-1",
    discordChannelId: "chan-1",
    lastDiscordMessageId: "msg-1",
    status: "ACTIVE" as const,
    contextJson: null,
    lastInteractionAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("maps reply reference to the matching active session", () => {
    const resolved = resolveSessionForReply([baseSession], "msg-1");
    assert.equal(resolved !== "ambiguous" && resolved?.id, "sess-1");
  });

  it("returns ambiguous when multiple active sessions and no reference", () => {
    const second = { ...baseSession, id: "sess-2", dealRoomId: "app-2", lastDiscordMessageId: "msg-2" };
    assert.equal(resolveSessionForReply([baseSession, second], null), "ambiguous");
  });

  it("uses the only active session when there is just one", () => {
    assert.equal(resolveSessionForReply([baseSession], null)?.id, "sess-1");
  });
});

describe("secure deal room urls and labels", () => {
  it("resolves customer lending thread url", () => {
    assert.equal(
      resolveCustomerDealRoomUrl("LOAN_APPLICATION", "loan-123"),
      "/bank/lending/applications/loan-123/thread",
    );
  });

  it("labels discord source for UI", () => {
    assert.equal(sourceLabel("discord"), "via Discord");
    assert.equal(sourceLabel("website"), null);
  });
});

describe("pending discord reply stash", () => {
  beforeEach(() => {
    resetPendingDiscordRepliesForTests();
  });

  it("stores pending content for ambiguous picker follow-up", () => {
    stashPendingDiscordReply("discord-9", "Follow-up message", false);
    assert.doesNotThrow(() => stashPendingDiscordReply("discord-9", "Follow-up message", false));
  });
});
