-- AlterEnum
ALTER TYPE "DealRoomStatus" ADD VALUE 'EXECUTED';

-- CreateEnum
CREATE TYPE "DealRoomAgreementDraftStatus" AS ENUM ('DRAFT', 'AWAITING_BORROWER', 'AWAITING_BANK', 'EXECUTED', 'VOID', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "DealRoomAgreementSignatureParty" AS ENUM ('BORROWER', 'BANK');

-- AlterTable
ALTER TABLE "DealRoom" ADD COLUMN "executedLoanId" TEXT;

-- CreateTable
CREATE TABLE "DealRoomAgreement" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "templateSlug" TEXT NOT NULL,
    "workspaceFieldData" JSONB NOT NULL,
    "activeDraftId" TEXT,
    "executedDraftId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoomAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomAgreementDraft" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "DealRoomAgreementDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "fieldData" JSONB NOT NULL,
    "pdfStorageKey" TEXT,
    "pdfSha256" TEXT,
    "generatedByUserId" TEXT,
    "generatedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoomAgreementDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomAgreementSignature" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "party" "DealRoomAgreementSignatureParty" NOT NULL,
    "userId" TEXT NOT NULL,
    "signatureName" TEXT NOT NULL,
    "discordId" TEXT,
    "ipAddress" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealRoomAgreementSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealRoom_executedLoanId_key" ON "DealRoom"("executedLoanId");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomAgreement_dealRoomId_key" ON "DealRoomAgreement"("dealRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomAgreement_activeDraftId_key" ON "DealRoomAgreement"("activeDraftId");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomAgreement_executedDraftId_key" ON "DealRoomAgreement"("executedDraftId");

-- CreateIndex
CREATE INDEX "DealRoomAgreement_templateSlug_idx" ON "DealRoomAgreement"("templateSlug");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomAgreementDraft_agreementId_versionNumber_key" ON "DealRoomAgreementDraft"("agreementId", "versionNumber");

-- CreateIndex
CREATE INDEX "DealRoomAgreementDraft_agreementId_status_idx" ON "DealRoomAgreementDraft"("agreementId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomAgreementSignature_draftId_party_key" ON "DealRoomAgreementSignature"("draftId", "party");

-- CreateIndex
CREATE INDEX "DealRoomAgreementSignature_draftId_idx" ON "DealRoomAgreementSignature"("draftId");

-- CreateIndex
CREATE INDEX "DealRoomAgreementSignature_userId_idx" ON "DealRoomAgreementSignature"("userId");

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_executedLoanId_fkey" FOREIGN KEY ("executedLoanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreement" ADD CONSTRAINT "DealRoomAgreement_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreement" ADD CONSTRAINT "DealRoomAgreement_activeDraftId_fkey" FOREIGN KEY ("activeDraftId") REFERENCES "DealRoomAgreementDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreement" ADD CONSTRAINT "DealRoomAgreement_executedDraftId_fkey" FOREIGN KEY ("executedDraftId") REFERENCES "DealRoomAgreementDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreementDraft" ADD CONSTRAINT "DealRoomAgreementDraft_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "DealRoomAgreement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreementDraft" ADD CONSTRAINT "DealRoomAgreementDraft_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreementDraft" ADD CONSTRAINT "DealRoomAgreementDraft_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreementSignature" ADD CONSTRAINT "DealRoomAgreementSignature_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "DealRoomAgreementDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomAgreementSignature" ADD CONSTRAINT "DealRoomAgreementSignature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
