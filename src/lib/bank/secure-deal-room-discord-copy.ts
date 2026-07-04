import type { SecureDealRoomType } from "@prisma/client";
import { DEAL_ROOM_TYPE_LABELS } from "@/lib/bank/secure-deal-room-discord-types";

const MAX_PREVIEW_CHARS = 500;
const MAX_REPLY_CHARS = 4000;

export function previewDealRoomMessage(body: string | null): string {
  const trimmed = body?.trim() ?? "";
  if (!trimmed) return "_No message text_";
  if (trimmed.length <= MAX_PREVIEW_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_PREVIEW_CHARS - 1)}…`;
}

export function buildDealRoomChannelName(input: {
  discordUsername: string;
  dealRoomType: SecureDealRoomType;
}): string {
  const slug =
    input.discordUsername
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 20) || "customer";

  const suffix = {
    LOAN_APPLICATION: "loan-app",
    ALTA_CARD_APPLICATION: "altacard",
    ALTA_CARD_REVIEW: "card-review",
  }[input.dealRoomType];

  return `dealroom-${slug}-${suffix}`.slice(0, 100);
}

export function buildDealRoomChannelWelcomeContent(): string {
  return "Keep application-related messages in this channel. Alta Bank is the official record.";
}

export function buildDiscordGuildChannelUrl(guildId: string, channelId: string): string {
  return `https://discord.com/channels/${guildId.trim()}/${channelId.trim()}`;
}

export function buildChannelOpenedDmTitle(): string {
  return "Your Secure Deal Room is ready";
}

export function buildChannelOpenedDmBody(input: {
  dealRoomType: SecureDealRoomType;
  channelName: string;
  discordChannelUrl: string;
}): string {
  const contextLabel = DEAL_ROOM_TYPE_LABELS[input.dealRoomType];
  return [
    "Your Secure Deal Room is ready.",
    "",
    `A private Discord channel has been created for your ${contextLabel}.`,
    "",
    "Continue in Discord:",
    `[#${input.channelName}](${input.discordChannelUrl})`,
    "",
    "You can also open your Deal Room on Alta Bank using the button below.",
  ].join("\n");
}

export function buildWebsiteToDiscordChannelEmbed(input: {
  senderDisplayName: string;
  messageBody: string | null;
}): { title: string; description: string } {
  return {
    title: input.senderDisplayName.trim().slice(0, 256) || "Alta Bank",
    description: previewDealRoomMessage(input.messageBody),
  };
}

/** @deprecated Use buildWebsiteToDiscordChannelEmbed for Discord delivery. */
export function buildWebsiteToDiscordChannelMessage(input: {
  senderDisplayName: string;
  messageBody: string | null;
}): string {
  const preview = previewDealRoomMessage(input.messageBody);
  return `${input.senderDisplayName} via Alta Bank:\n${preview}`.slice(0, 2000);
}

export function sanitizeDiscordReplyContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REPLY_CHARS);
}

export const DEAL_ROOM_CHANNEL_CLOSED_NOTICE =
  "This Deal Room is closed on Alta Bank. Staff may still review message history here.";

export const DEAL_ROOM_CHANNEL_FAILURE_COPY = {
  closed:
    "This Secure Deal Room is closed. Please open Alta Bank if you need further assistance.",
  wrongUser: "This Deal Room is only available to the invited customer or Alta staff.",
  attachment:
    "Attachments must be uploaded through Alta Bank for now. Open your Secure Deal Room on the website to share documents.",
  empty: "Please send a text message in your Secure Deal Room channel.",
} as const;

/** Applicant/customer side wins when a user is both staff and the deal room customer. */
export function resolveDiscordChannelSenderRole(input: {
  isApplicant: boolean;
  isStaff: boolean;
}): "APPLICANT" | "ALTA_STAFF" | null {
  if (input.isApplicant) return "APPLICANT";
  if (input.isStaff) return "ALTA_STAFF";
  return null;
}
