-- CreateEnum
CREATE TYPE "DealRoomMessageType" AS ENUM (
  'APPLICANT_MESSAGE',
  'OFFICER_MESSAGE',
  'SYSTEM_UPDATE',
  'INTERNAL_NOTE'
);

-- CreateTable
CREATE TABLE "DealRoomMessage" (
  "id" TEXT NOT NULL,
  "dealRoomId" TEXT NOT NULL,
  "senderUserId" TEXT,
  "messageType" "DealRoomMessageType" NOT NULL,
  "body" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "DealRoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealRoomMessage_dealRoomId_createdAt_idx" ON "DealRoomMessage"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "DealRoomMessage_senderUserId_idx" ON "DealRoomMessage"("senderUserId");

-- CreateIndex
CREATE INDEX "DealRoomMessage_messageType_idx" ON "DealRoomMessage"("messageType");

-- AddForeignKey
ALTER TABLE "DealRoomMessage" ADD CONSTRAINT "DealRoomMessage_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomMessage" ADD CONSTRAINT "DealRoomMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
