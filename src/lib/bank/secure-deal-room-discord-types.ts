import type { SecureDealRoomType } from "@prisma/client";

export type SecureDealRoomTypeCode =
  | "loan_application"
  | "alta_card_application"
  | "alta_card_review";

export type SecureDealRoomMessageSourceCode = "website" | "discord" | "system";

export type SecureDealRoomDiscordContext = {
  cardId?: string | null;
  companyId?: string | null;
};

export type StaffDealRoomMessageNotifyInput = {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  applicantUserId: string;
  staffUserId: string;
  staffDisplayName: string;
  messageId: string;
  messageBody: string | null;
  context?: SecureDealRoomDiscordContext;
};

export type DiscordDealRoomReplyInput = {
  discordUserId: string;
  discordChannelId: string;
  discordMessageId: string;
  referencedDiscordMessageId?: string | null;
  content: string;
  hasAttachments: boolean;
};

export type DiscordDealRoomReplyResult =
  | { ok: true; kind: "message_posted"; confirmationText: string }
  | { ok: true; kind: "picker"; pickerText: string; options: Array<{ label: string; dealRoomType: SecureDealRoomType; dealRoomId: string }> }
  | { ok: false; replyText: string; linkUrl?: string };

export const DEAL_ROOM_TYPE_LABELS: Record<SecureDealRoomType, string> = {
  LOAN_APPLICATION: "Loan Application",
  ALTA_CARD_APPLICATION: "Alta Card Application",
  ALTA_CARD_REVIEW: "Alta Card Review",
};

export function sourceCodeFromDb(
  source: import("@prisma/client").SecureDealRoomMessageSource,
): SecureDealRoomMessageSourceCode {
  switch (source) {
    case "DISCORD":
      return "discord";
    case "SYSTEM":
      return "system";
    default:
      return "website";
  }
}

export function sourceLabel(source: SecureDealRoomMessageSourceCode): string | null {
  if (source === "discord") return "via Discord";
  if (source === "website") return null;
  return null;
}
