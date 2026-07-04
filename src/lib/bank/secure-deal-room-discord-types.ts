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

export type WebsiteMessageSyncInput = {
  dealRoomType: SecureDealRoomType;
  dealRoomId: string;
  threadId: string;
  messageId: string;
  messageBody: string | null;
  senderUserId: string;
  senderDisplayName: string;
  senderRole: "APPLICANT" | "ALTA_STAFF";
  context?: SecureDealRoomDiscordContext;
};

export type DiscordChannelAttachmentInput = {
  discordAttachmentId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

export type DiscordChannelMessageInput = {
  discordChannelId: string;
  discordMessageId: string;
  discordUserId: string;
  content: string;
  /** @deprecated Prefer attachments.length > 0 */
  hasAttachments?: boolean;
  attachments?: DiscordChannelAttachmentInput[];
};

export type EnsureChannelDispatchInput = {
  channelName: string;
  customerDiscordUserId: string;
  dealRoomType: string;
  dealRoomId: string;
  welcomeContent: string;
  linkUrl: string;
  existingChannelId?: string | null;
};

export type EnsureChannelDispatchResult = {
  ok: boolean;
  channelId?: string;
  channelName?: string;
  linked?: boolean;
  reason?: string;
};

export type DiscordChannelMessageResult =
  | { kind: "synced"; messageId: string }
  | { kind: "ignored" }
  | { kind: "duplicate" }
  | { kind: "unauthorized" }
  | { kind: "closed" }
  | { kind: "failed"; reason: string };

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
  if (source === "website") return "via Website";
  return null;
}
