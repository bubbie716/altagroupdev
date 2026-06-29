-- CreateEnum
CREATE TYPE "AltaPrivateInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AltaPrivateInvitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AltaPrivateInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "invitationMessage" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AltaPrivateInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AltaPrivateInvitation_userId_status_idx" ON "AltaPrivateInvitation"("userId", "status");

-- CreateIndex
CREATE INDEX "AltaPrivateInvitation_status_createdAt_idx" ON "AltaPrivateInvitation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AltaPrivateInvitation_invitedByUserId_idx" ON "AltaPrivateInvitation"("invitedByUserId");

-- AddForeignKey
ALTER TABLE "AltaPrivateInvitation" ADD CONSTRAINT "AltaPrivateInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AltaPrivateInvitation" ADD CONSTRAINT "AltaPrivateInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
