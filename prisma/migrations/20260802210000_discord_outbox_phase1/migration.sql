-- CreateEnum
CREATE TYPE "DiscordOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'HANDED_OFF', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "DiscordOutbox" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetBot" TEXT NOT NULL DEFAULT 'bank',
    "channelClass" TEXT NOT NULL,
    "severity" TEXT,
    "correlationId" TEXT,
    "actorJson" JSONB,
    "subjectJson" JSONB,
    "displayPayload" JSONB NOT NULL,
    "internalRef" JSONB,
    "deliveryPolicy" TEXT NOT NULL DEFAULT 'queued',
    "status" "DiscordOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "discordMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscordOutbox_eventId_key" ON "DiscordOutbox"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordOutbox_idempotencyKey_key" ON "DiscordOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DiscordOutbox_status_nextAttemptAt_idx" ON "DiscordOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "DiscordOutbox_targetBot_status_idx" ON "DiscordOutbox"("targetBot", "status");

-- CreateIndex
CREATE INDEX "DiscordOutbox_product_eventType_idx" ON "DiscordOutbox"("product", "eventType");

-- CreateIndex
CREATE INDEX "DiscordOutbox_correlationId_idx" ON "DiscordOutbox"("correlationId");
