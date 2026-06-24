-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "proofFileName" TEXT,
ADD COLUMN "proofUploadedAt" TIMESTAMP(3),
ADD COLUMN "proofMimeType" TEXT,
ADD COLUMN "proofSizeBytes" INTEGER;
