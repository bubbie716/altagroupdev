-- CreateEnum
CREATE TYPE "DealRoomDocumentType" AS ENUM ('IDENTIFICATION', 'INCOME_VERIFICATION', 'BANK_STATEMENT', 'TAX_DOCUMENT', 'BUSINESS_FINANCIALS', 'COLLATERAL', 'SUPPORTING_DOCUMENT', 'CONTRACT_DRAFT', 'SIGNED_CONTRACT', 'INTERNAL_MEMO', 'OTHER');

-- CreateEnum
CREATE TYPE "DealRoomDocumentVisibility" AS ENUM ('SHARED', 'INTERNAL_ONLY');

-- CreateEnum
CREATE TYPE "DealRoomDocumentStatus" AS ENUM ('ACTIVE', 'REPLACED', 'DELETED');

-- CreateEnum
CREATE TYPE "DealRoomDocumentRequestStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "DealRoomDocument" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "documentType" "DealRoomDocumentType" NOT NULL,
    "visibility" "DealRoomDocumentVisibility" NOT NULL DEFAULT 'SHARED',
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "description" TEXT,
    "status" "DealRoomDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "replacedByDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DealRoomDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomDocumentRequest" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "documentType" "DealRoomDocumentType" NOT NULL,
    "status" "DealRoomDocumentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "title" TEXT,
    "requestNote" TEXT,
    "reviewNote" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "linkedDocumentId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealRoomDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomDocument_replacedByDocumentId_key" ON "DealRoomDocument"("replacedByDocumentId");

-- CreateIndex
CREATE INDEX "DealRoomDocument_dealRoomId_createdAt_idx" ON "DealRoomDocument"("dealRoomId", "createdAt");

-- CreateIndex
CREATE INDEX "DealRoomDocument_dealRoomId_status_idx" ON "DealRoomDocument"("dealRoomId", "status");

-- CreateIndex
CREATE INDEX "DealRoomDocument_dealRoomId_documentType_idx" ON "DealRoomDocument"("dealRoomId", "documentType");

-- CreateIndex
CREATE INDEX "DealRoomDocument_uploadedByUserId_idx" ON "DealRoomDocument"("uploadedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomDocumentRequest_linkedDocumentId_key" ON "DealRoomDocumentRequest"("linkedDocumentId");

-- CreateIndex
CREATE INDEX "DealRoomDocumentRequest_dealRoomId_documentType_idx" ON "DealRoomDocumentRequest"("dealRoomId", "documentType");

-- CreateIndex
CREATE INDEX "DealRoomDocumentRequest_dealRoomId_status_idx" ON "DealRoomDocumentRequest"("dealRoomId", "status");

-- AddForeignKey
ALTER TABLE "DealRoomDocument" ADD CONSTRAINT "DealRoomDocument_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomDocument" ADD CONSTRAINT "DealRoomDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomDocument" ADD CONSTRAINT "DealRoomDocument_replacedByDocumentId_fkey" FOREIGN KEY ("replacedByDocumentId") REFERENCES "DealRoomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomDocumentRequest" ADD CONSTRAINT "DealRoomDocumentRequest_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomDocumentRequest" ADD CONSTRAINT "DealRoomDocumentRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomDocumentRequest" ADD CONSTRAINT "DealRoomDocumentRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomDocumentRequest" ADD CONSTRAINT "DealRoomDocumentRequest_linkedDocumentId_fkey" FOREIGN KEY ("linkedDocumentId") REFERENCES "DealRoomDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
