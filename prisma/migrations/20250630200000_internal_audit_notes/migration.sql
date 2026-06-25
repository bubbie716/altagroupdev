-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'BANK_ACCOUNT', 'BANK_TRANSACTION', 'COMPANY', 'LOAN', 'LOAN_APPLICATION', 'SCHEDULED_PAYMENT', 'STATEMENT');

-- CreateEnum
CREATE TYPE "InternalNoteTargetType" AS ENUM ('USER', 'BANK_ACCOUNT', 'COMPANY', 'LOAN');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetAccountId" TEXT,
    "targetCompanyId" TEXT,
    "targetTransactionId" TEXT,
    "targetLoanId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "targetType" "InternalNoteTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");
CREATE INDEX "AuditLog_targetUserId_idx" ON "AuditLog"("targetUserId");
CREATE INDEX "AuditLog_targetAccountId_idx" ON "AuditLog"("targetAccountId");
CREATE INDEX "AuditLog_targetCompanyId_idx" ON "AuditLog"("targetCompanyId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "InternalNote_targetType_targetId_idx" ON "InternalNote"("targetType", "targetId");
CREATE INDEX "InternalNote_createdAt_idx" ON "InternalNote"("createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
