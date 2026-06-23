-- Company membership invitations (in-app acceptance; Discord bot delivery planned).
CREATE TYPE "CompanyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "CompanyInvitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "invitedDiscordId" TEXT,
    "invitedDiscordUsername" TEXT,
    "role" "CompanyRole" NOT NULL,
    "status" "CompanyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyInvitation_companyId_status_idx" ON "CompanyInvitation"("companyId", "status");
CREATE INDEX "CompanyInvitation_invitedUserId_status_idx" ON "CompanyInvitation"("invitedUserId", "status");
CREATE INDEX "CompanyInvitation_invitedDiscordId_status_idx" ON "CompanyInvitation"("invitedDiscordId", "status");

ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
