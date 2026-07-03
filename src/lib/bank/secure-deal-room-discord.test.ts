import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDealRoomChannelName,
  buildWebsiteToDiscordChannelMessage,
  sanitizeDiscordReplyContent,
} from "@/lib/bank/secure-deal-room-discord-copy";
import {
  resolveCustomerDealRoomUrl,
  resolveSessionForReply,
} from "@/server/secure-deal-room-discord.service";
import { sourceLabel } from "@/lib/bank/secure-deal-room-discord-types";

describe("secure deal room discord channel copy", () => {
  it("builds short channel names per deal room type", () => {
    assert.equal(
      buildDealRoomChannelName({
        discordUsername: "Carter Townshend",
        dealRoomType: "ALTA_CARD_REVIEW",
      }),
      "dealroom-cartertownshend-card-review",
    );
    assert.equal(
      buildDealRoomChannelName({
        discordUsername: "FTLCEO",
        dealRoomType: "LOAN_APPLICATION",
      }),
      "dealroom-ftlceo-loan-app",
    );
    assert.equal(
      buildDealRoomChannelName({
        discordUsername: "FTLCEO",
        dealRoomType: "ALTA_CARD_APPLICATION",
      }),
      "dealroom-ftlceo-altacard",
    );
  });

  it("formats website messages for Discord channel sync", () => {
    const body = buildWebsiteToDiscordChannelMessage({
      senderDisplayName: "FTLCEO",
      messageBody: "Can you provide proof of income?",
    });
    assert.match(body, /FTLCEO via Alta Bank:/);
    assert.match(body, /proof of income/);
  });

  it("sanitizes and caps discord reply content", () => {
    assert.equal(sanitizeDiscordReplyContent("  hello  "), "hello");
    assert.equal(sanitizeDiscordReplyContent("   "), null);
    assert.equal(sanitizeDiscordReplyContent("x".repeat(5000))?.length, 4000);
  });
});

describe("secure deal room session resolution (legacy)", () => {
  const baseSession = {
    id: "sess-1",
    dealRoomType: "LOAN_APPLICATION" as const,
    dealRoomId: "app-1",
    threadId: "thread-1",
    userId: "user-1",
    discordUserId: "discord-1",
    discordChannelId: "chan-1",
    discordChannelName: "dealroom-ftlceo-loan-app",
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
});

describe("secure deal room urls and labels", () => {
  it("resolves customer lending thread url", () => {
    assert.equal(
      resolveCustomerDealRoomUrl("LOAN_APPLICATION", "loan-123"),
      "/bank/lending/applications/loan-123/thread",
    );
  });

  it("labels website and discord sources for UI", () => {
    assert.equal(sourceLabel("discord"), "via Discord");
    assert.equal(sourceLabel("website"), "via Website");
    assert.equal(sourceLabel("system"), null);
  });
});
