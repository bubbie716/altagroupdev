-- CreateEnum
CREATE TYPE "OpsReviewFlagTargetType" AS ENUM ('USER', 'COMPANY', 'BANK_ACCOUNT', 'BANK_TRANSACTION', 'LOAN', 'ALTA_CARD');

-- CreateEnum
CREATE TYPE "OpsReviewFlagReason" AS ENUM ('SUSPICIOUS_ACTIVITY', 'IDENTITY_CONCERN', 'MANUAL_REVIEW', 'HIGH_RISK', 'COMPLIANCE_REVIEW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OpsReviewFlagStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "OpsExceptionDispositionStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED', 'DISMISSED');

-- CreateTable
CREATE TABLE "OpsReviewFlag" (
    "id" TEXT NOT NULL,
    "targetType" "OpsReviewFlagTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "OpsReviewFlagReason" NOT NULL,
    "customReason" TEXT,
    "status" "OpsReviewFlagStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "resolvedByUserId" TEXT,
    "resolveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OpsReviewFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsExceptionDisposition" (
    "id" TEXT NOT NULL,
    "exceptionKey" TEXT NOT NULL,
    "status" "OpsExceptionDispositionStatus" NOT NULL DEFAULT 'OPEN',
    "lastReason" TEXT,
    "lastActorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsExceptionDisposition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsReviewFlag_targetType_targetId_idx" ON "OpsReviewFlag"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "OpsReviewFlag_status_idx" ON "OpsReviewFlag"("status");

-- CreateIndex
CREATE INDEX "OpsReviewFlag_createdAt_idx" ON "OpsReviewFlag"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpsExceptionDisposition_exceptionKey_key" ON "OpsExceptionDisposition"("exceptionKey");

-- CreateIndex
CREATE INDEX "OpsExceptionDisposition_status_idx" ON "OpsExceptionDisposition"("status");

-- CreateIndex
CREATE INDEX "OpsExceptionDisposition_updatedAt_idx" ON "OpsExceptionDisposition"("updatedAt");

-- AddForeignKey
ALTER TABLE "OpsReviewFlag" ADD CONSTRAINT "OpsReviewFlag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsReviewFlag" ADD CONSTRAINT "OpsReviewFlag_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsExceptionDisposition" ADD CONSTRAINT "OpsExceptionDisposition_lastActorUserId_fkey" FOREIGN KEY ("lastActorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
