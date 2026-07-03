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

export function buildStaffDealRoomDmTitle(dealRoomType: SecureDealRoomType): string {
  return `New message in your Secure Deal Room`;
}

export function buildStaffDealRoomDmBody(input: {
  dealRoomType: SecureDealRoomType;
  staffDisplayName: string;
  messageBody: string | null;
}): string {
  const contextLabel = DEAL_ROOM_TYPE_LABELS[input.dealRoomType];
  const preview = previewDealRoomMessage(input.messageBody);
  return [
    `**${contextLabel}**`,
    "",
    `**${input.staffDisplayName}:**`,
    `> ${preview.replace(/\n/g, "\n> ")}`,
    "",
    "You can reply directly to this message or continue on Alta Bank.",
  ].join("\n");
}

export function sanitizeDiscordReplyContent(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_REPLY_CHARS);
}

export const DEAL_ROOM_REPLY_FAILURE_COPY = {
  ambiguous:
    "Alta could not determine which Secure Deal Room this reply belongs to. Please open your Deal Room on Alta Bank to continue.",
  pickerPrompt: "You have multiple active Secure Deal Rooms. Choose which one this reply is for:",
  closed:
    "This Secure Deal Room is closed. Please open Alta Bank if you need further assistance.",
  wrongUser: "This Deal Room is only available to the invited customer.",
  attachment:
    "Attachments must be uploaded through Alta Bank for now. Open your Secure Deal Room on the website to share documents.",
  empty: "Please send a text message to reply to your Secure Deal Room.",
  posted: "Your message was added to your Secure Deal Room on Alta Bank.",
} as const;
