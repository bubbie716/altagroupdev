-- Alta Card application workflow: expanded status, thread, approval fields

CREATE TYPE "AltaCardApplicationStatus_new" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFO',
  'APPROVED',
  'DENIED',
  'CANCELLED'
);

ALTER TABLE "AltaCardApplication" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "AltaCardApplication"
  ALTER COLUMN "status" TYPE "AltaCardApplicationStatus_new"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'SUBMITTED'
      WHEN 'APPROVED' THEN 'APPROVED'
      WHEN 'DENIED' THEN 'DENIED'
      WHEN 'CANCELLED' THEN 'CANCELLED'
      ELSE 'SUBMITTED'
    END::"AltaCardApplicationStatus_new"
  );

DROP TYPE "AltaCardApplicationStatus";
ALTER TYPE "AltaCardApplicationStatus_new" RENAME TO "AltaCardApplicationStatus";
ALTER TABLE "AltaCardApplication" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

ALTER TABLE "AltaCardApplication"
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "paymentSourceAccountId" TEXT,
  ADD COLUMN "expectedMonthlySpend" DECIMAL(18,2),
  ADD COLUMN "employeeCardsNeeded" BOOLEAN,
  ADD COLUMN "approvedTier" "AltaCardTier",
  ADD COLUMN "approvedInterestRate" DECIMAL(10,6),
  ADD COLUMN "billingCycleDay" INTEGER,
  ADD COLUMN "goldOverride" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acceptedAt" TIMESTAMP(3);

UPDATE "AltaCardApplication"
SET "approvedInterestRate" = "interestRate"
WHERE "interestRate" IS NOT NULL;

ALTER TABLE "AltaCardApplication" DROP COLUMN "interestRate";

ALTER TABLE "AltaCardApplication"
  ADD CONSTRAINT "AltaCardApplication_paymentSourceAccountId_fkey"
  FOREIGN KEY ("paymentSourceAccountId") REFERENCES "BankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "AltaCardApplicationThreadStatus" AS ENUM (
  'OPEN',
  'WAITING_ON_APPLICANT',
  'WAITING_ON_ALTA',
  'CLOSED'
);

CREATE TYPE "AltaCardApplicationThreadSenderRole" AS ENUM (
  'APPLICANT',
  'ALTA_STAFF',
  'SYSTEM'
);

CREATE TABLE "AltaCardApplicationThread" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "applicantUserId" TEXT NOT NULL,
  "companyId" TEXT,
  "status" "AltaCardApplicationThreadStatus" NOT NULL DEFAULT 'WAITING_ON_ALTA',
  "assignedStaffId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),

  CONSTRAINT "AltaCardApplicationThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AltaCardApplicationThread_applicationId_key" ON "AltaCardApplicationThread"("applicationId");
CREATE INDEX "AltaCardApplicationThread_applicantUserId_idx" ON "AltaCardApplicationThread"("applicantUserId");
CREATE INDEX "AltaCardApplicationThread_companyId_idx" ON "AltaCardApplicationThread"("companyId");
CREATE INDEX "AltaCardApplicationThread_status_idx" ON "AltaCardApplicationThread"("status");
CREATE INDEX "AltaCardApplicationThread_assignedStaffId_idx" ON "AltaCardApplicationThread"("assignedStaffId");

CREATE TABLE "AltaCardApplicationThreadMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderUserId" TEXT,
  "senderRole" "AltaCardApplicationThreadSenderRole" NOT NULL,
  "body" TEXT,
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "AltaCardApplicationThreadMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AltaCardApplicationThreadMessage_threadId_createdAt_idx"
  ON "AltaCardApplicationThreadMessage"("threadId", "createdAt");

ALTER TABLE "AltaCardApplicationThread"
  ADD CONSTRAINT "AltaCardApplicationThread_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "AltaCardApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AltaCardApplicationThread"
  ADD CONSTRAINT "AltaCardApplicationThread_applicantUserId_fkey"
  FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AltaCardApplicationThread"
  ADD CONSTRAINT "AltaCardApplicationThread_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCardApplicationThread"
  ADD CONSTRAINT "AltaCardApplicationThread_assignedStaffId_fkey"
  FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCardApplicationThreadMessage"
  ADD CONSTRAINT "AltaCardApplicationThreadMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "AltaCardApplicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AltaCardApplicationThreadMessage"
  ADD CONSTRAINT "AltaCardApplicationThreadMessage_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCard" ADD COLUMN "billingCycleDay" INTEGER;

-- Backfill threads for existing applications
INSERT INTO "AltaCardApplicationThread" ("id", "applicationId", "applicantUserId", "companyId", "status", "createdAt", "updatedAt")
SELECT
  'act_' || "id",
  "id",
  "applicantUserId",
  "companyId",
  CASE WHEN "status" IN ('DENIED', 'CANCELLED') THEN 'CLOSED'::"AltaCardApplicationThreadStatus"
       WHEN "status" = 'APPROVED' THEN 'CLOSED'::"AltaCardApplicationThreadStatus"
       ELSE 'WAITING_ON_ALTA'::"AltaCardApplicationThreadStatus"
  END,
  "createdAt",
  "updatedAt"
FROM "AltaCardApplication" a
WHERE NOT EXISTS (
  SELECT 1 FROM "AltaCardApplicationThread" t WHERE t."applicationId" = a."id"
);

INSERT INTO "AltaCardApplicationThreadMessage" ("id", "threadId", "senderRole", "body", "createdAt")
SELECT
  'actm_' || a."id",
  t."id",
  'SYSTEM'::"AltaCardApplicationThreadSenderRole",
  'Your Alta Card application has been received.',
  a."createdAt"
FROM "AltaCardApplication" a
JOIN "AltaCardApplicationThread" t ON t."applicationId" = a."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "AltaCardApplicationThreadMessage" m WHERE m."threadId" = t."id"
);
