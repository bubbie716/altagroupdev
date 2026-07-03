CREATE TYPE "SecureDealRoomType" AS ENUM (
  'LOAN_APPLICATION',
  'ALTA_CARD_APPLICATION',
  'ALTA_CARD_REVIEW'
);

CREATE TYPE "SecureDealRoomDiscordSessionStatus" AS ENUM (
  'ACTIVE',
  'CLOSED',
  'EXPIRED'
);

CREATE TYPE "SecureDealRoomMessageSource" AS ENUM (
  'WEBSITE',
  'DISCORD',
  'SYSTEM'
);

CREATE TABLE "SecureDealRoomDiscordSession" (
  "id" TEXT NOT NULL,
  "dealRoomType" "SecureDealRoomType" NOT NULL,
  "dealRoomId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "discordChannelId" TEXT,
  "lastDiscordMessageId" TEXT,
  "status" "SecureDealRoomDiscordSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "contextJson" JSONB,
  "lastInteractionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SecureDealRoomDiscordSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SecureDealRoomDiscordSession_dealRoomType_dealRoomId_key"
  ON "SecureDealRoomDiscordSession"("dealRoomType", "dealRoomId");
CREATE INDEX "SecureDealRoomDiscordSession_userId_status_idx"
  ON "SecureDealRoomDiscordSession"("userId", "status");
CREATE INDEX "SecureDealRoomDiscordSession_discordUserId_status_idx"
  ON "SecureDealRoomDiscordSession"("discordUserId", "status");
CREATE INDEX "SecureDealRoomDiscordSession_lastDiscordMessageId_idx"
  ON "SecureDealRoomDiscordSession"("lastDiscordMessageId");

ALTER TABLE "SecureDealRoomDiscordSession"
  ADD CONSTRAINT "SecureDealRoomDiscordSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoanApplicationThreadMessage"
  ADD COLUMN "source" "SecureDealRoomMessageSource" NOT NULL DEFAULT 'WEBSITE';

ALTER TABLE "AltaCardApplicationThreadMessage"
  ADD COLUMN "source" "SecureDealRoomMessageSource" NOT NULL DEFAULT 'WEBSITE';

ALTER TABLE "AltaCardReviewThreadMessage"
  ADD COLUMN "source" "SecureDealRoomMessageSource" NOT NULL DEFAULT 'WEBSITE';

UPDATE "LoanApplicationThreadMessage"
SET "source" = 'SYSTEM'
WHERE "senderRole" = 'SYSTEM';

UPDATE "AltaCardApplicationThreadMessage"
SET "source" = 'SYSTEM'
WHERE "senderRole" = 'SYSTEM';

UPDATE "AltaCardReviewThreadMessage"
SET "source" = 'SYSTEM'
WHERE "senderRole" = 'SYSTEM';
