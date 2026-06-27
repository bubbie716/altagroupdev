-- Scheduled manual interest applications (category-based promotional credits).

CREATE TYPE "ScheduledManualInterestStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED', 'FAILED');

CREATE TABLE "ScheduledManualInterestApplication" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ScheduledManualInterestStatus" NOT NULL DEFAULT 'PENDING',
    "batchReferenceId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "applyResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledManualInterestApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledManualInterestApplication_idempotencyKey_key" ON "ScheduledManualInterestApplication"("idempotencyKey");
CREATE INDEX "ScheduledManualInterestApplication_status_scheduledFor_idx" ON "ScheduledManualInterestApplication"("status", "scheduledFor");
CREATE INDEX "ScheduledManualInterestApplication_createdByUserId_idx" ON "ScheduledManualInterestApplication"("createdByUserId");

ALTER TABLE "ScheduledManualInterestApplication" ADD CONSTRAINT "ScheduledManualInterestApplication_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
