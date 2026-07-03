-- Secure Deal Room Discord private channel bridge

ALTER TABLE "SecureDealRoomDiscordSession" ADD COLUMN "discordChannelName" TEXT;

CREATE INDEX "SecureDealRoomDiscordSession_discordChannelId_idx"
  ON "SecureDealRoomDiscordSession"("discordChannelId");

ALTER TABLE "LoanApplicationThreadMessage" ADD COLUMN "discordMessageId" TEXT;
ALTER TABLE "AltaCardApplicationThreadMessage" ADD COLUMN "discordMessageId" TEXT;
ALTER TABLE "AltaCardReviewThreadMessage" ADD COLUMN "discordMessageId" TEXT;

CREATE UNIQUE INDEX "LoanApplicationThreadMessage_discordMessageId_key"
  ON "LoanApplicationThreadMessage"("discordMessageId")
  WHERE "discordMessageId" IS NOT NULL;

CREATE UNIQUE INDEX "AltaCardApplicationThreadMessage_discordMessageId_key"
  ON "AltaCardApplicationThreadMessage"("discordMessageId")
  WHERE "discordMessageId" IS NOT NULL;

CREATE UNIQUE INDEX "AltaCardReviewThreadMessage_discordMessageId_key"
  ON "AltaCardReviewThreadMessage"("discordMessageId")
  WHERE "discordMessageId" IS NOT NULL;
