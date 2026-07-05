import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChannelOpenedDmBody,
  buildDealRoomChannelName,
  buildDiscordGuildChannelUrl,
  buildWebsiteToDiscordChannelEmbed,
  buildWebsiteToDiscordChannelMessage,
  resolveDiscordChannelSenderRole,
  resolveWebsiteToDiscordSenderDisplayName,
  sanitizeDiscordReplyContent,
} from "@/lib/bank/secure-deal-room-discord-copy";
import { buildDealRoomOpenedDmPayload } from "@/lib/discord/notification-dm";
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
    const embed = buildWebsiteToDiscordChannelEmbed({
      senderDisplayName: "FTLCEO",
      messageBody: "Can you provide proof of income?",
    });
    assert.equal(embed.title, "FTLCEO");
    assert.match(embed.description, /proof of income/);

    const legacy = buildWebsiteToDiscordChannelMessage({
      senderDisplayName: "FTLCEO",
      messageBody: "Can you provide proof of income?",
    });
    assert.match(legacy, /FTLCEO via Alta Bank:/);
  });

  it("shows admin panel staff messages as Alta Credit Desk in Discord", () => {
    assert.equal(
      resolveWebsiteToDiscordSenderDisplayName({
        senderRole: "ALTA_STAFF",
        senderDisplayName: "FTLCEO",
      }),
      "Alta Credit Desk",
    );
    assert.equal(
      resolveWebsiteToDiscordSenderDisplayName({
        senderRole: "APPLICANT",
        senderDisplayName: "FTLCEO",
      }),
      "FTLCEO",
    );

    const embed = buildWebsiteToDiscordChannelEmbed({
      senderDisplayName: resolveWebsiteToDiscordSenderDisplayName({
        senderRole: "ALTA_STAFF",
        senderDisplayName: "FTLCEO",
      }),
      messageBody: "Please upload your latest statement.",
    });
    assert.equal(embed.title, "Alta Credit Desk");
  });

  it("builds clickable discord channel links for opened deal room DMs", () => {
    const url = buildDiscordGuildChannelUrl("guild-1", "channel-9");
    assert.equal(url, "https://discord.com/channels/guild-1/channel-9");

    const body = buildChannelOpenedDmBody({
      dealRoomType: "ALTA_CARD_APPLICATION",
      channelName: "dealroom-trappman1-altacard",
      discordChannelUrl: url,
    });
    assert.match(body, /\[#dealroom-trappman1-altacard\]\(https:\/\/discord\.com\/channels\/guild-1\/channel-9\)/);

    const payload = buildDealRoomOpenedDmPayload({
      title: "Your Secure Deal Room is ready",
      body,
      discordChannelUrl: url,
      websiteLinkUrl: "/bank/alta-card/applications/app-1/thread",
    });
    const row = payload.components[0] as { components: Array<{ label: string; url: string }> };
    assert.equal(row.components[0]?.label, "Open channel");
    assert.equal(row.components[0]?.url, url);
    assert.equal(row.components[1]?.label, "Open Alta Bank");
  });

  it("sanitizes and caps discord reply content", () => {
    assert.equal(sanitizeDiscordReplyContent("  hello  "), "hello");
    assert.equal(sanitizeDiscordReplyContent("   "), null);
    assert.equal(sanitizeDiscordReplyContent("x".repeat(5000))?.length, 4000);
  });

  it("prefers applicant role when discord author is both staff and customer", () => {
    assert.equal(
      resolveDiscordChannelSenderRole({ isApplicant: true, isStaff: true }),
      "APPLICANT",
    );
    assert.equal(
      resolveDiscordChannelSenderRole({ isApplicant: false, isStaff: true }),
      "ALTA_STAFF",
    );
    assert.equal(
      resolveDiscordChannelSenderRole({ isApplicant: true, isStaff: false }),
      "APPLICANT",
    );
    assert.equal(resolveDiscordChannelSenderRole({ isApplicant: false, isStaff: false }), null);
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
