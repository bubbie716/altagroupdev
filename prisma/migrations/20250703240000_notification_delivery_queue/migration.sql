-- CreateEnum
CREATE TYPE "NotificationDeliveryQueueStatus" AS ENUM ('PENDING', 'RETRYING', 'SENT', 'PERMANENT_FAILURE');

-- CreateTable
CREATE TABLE "NotificationDeliveryQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'DISCORD_DM',
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "status" "NotificationDeliveryQueueStatus" NOT NULL DEFAULT 'PENDING',
    "sourceAction" TEXT,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDeliveryQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDeliveryQueue_dedupeKey_key" ON "NotificationDeliveryQueue"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationDeliveryQueue_status_nextRetryAt_idx" ON "NotificationDeliveryQueue"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "NotificationDeliveryQueue_userId_idx" ON "NotificationDeliveryQueue"("userId");

-- AddForeignKey
ALTER TABLE "NotificationDeliveryQueue" ADD CONSTRAINT "NotificationDeliveryQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
