-- Alta Card account review requests and secure review threads.

CREATE TYPE "AltaCardReviewStatus" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'APPROVED',
  'PARTIALLY_APPROVED',
  'DENIED',
  'CANCELLED'
);

CREATE TABLE "AltaCardReviewRequest" (
    "id" TEXT NOT NULL,
    "altaCardId" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "requestLimitIncrease" BOOLEAN NOT NULL DEFAULT false,
    "requestRateReduction" BOOLEAN NOT NULL DEFAULT false,
    "requestTierUpgrade" BOOLEAN NOT NULL DEFAULT false,
    "requestedLimit" DECIMAL(18,2),
    "requestedRate" DECIMAL(10,6),
    "requestedTier" "AltaCardTier",
    "notes" TEXT,
    "status" "AltaCardReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvedLimit" DECIMAL(18,2),
    "approvedRate" DECIMAL(10,6),
    "approvedTier" "AltaCardTier",
    "approvedLimitIncrease" BOOLEAN,
    "approvedRateReduction" BOOLEAN,
    "approvedTierUpgrade" BOOLEAN,
    "decisionNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AltaCardReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AltaCardReviewThread" (
    "id" TEXT NOT NULL,
    "reviewRequestId" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "status" "AltaCardApplicationThreadStatus" NOT NULL DEFAULT 'WAITING_ON_ALTA',
    "assignedStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "AltaCardReviewThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AltaCardReviewThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" "AltaCardApplicationThreadSenderRole" NOT NULL,
    "body" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AltaCardReviewThreadMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AltaCardReviewThread_reviewRequestId_key" ON "AltaCardReviewThread"("reviewRequestId");
CREATE INDEX "AltaCardReviewRequest_altaCardId_idx" ON "AltaCardReviewRequest"("altaCardId");
CREATE INDEX "AltaCardReviewRequest_applicantUserId_idx" ON "AltaCardReviewRequest"("applicantUserId");
CREATE INDEX "AltaCardReviewRequest_companyId_idx" ON "AltaCardReviewRequest"("companyId");
CREATE INDEX "AltaCardReviewRequest_status_idx" ON "AltaCardReviewRequest"("status");
CREATE INDEX "AltaCardReviewRequest_createdAt_idx" ON "AltaCardReviewRequest"("createdAt");
CREATE INDEX "AltaCardReviewThread_applicantUserId_idx" ON "AltaCardReviewThread"("applicantUserId");
CREATE INDEX "AltaCardReviewThread_companyId_idx" ON "AltaCardReviewThread"("companyId");
CREATE INDEX "AltaCardReviewThread_status_idx" ON "AltaCardReviewThread"("status");
CREATE INDEX "AltaCardReviewThread_assignedStaffId_idx" ON "AltaCardReviewThread"("assignedStaffId");
CREATE INDEX "AltaCardReviewThreadMessage_threadId_createdAt_idx" ON "AltaCardReviewThreadMessage"("threadId", "createdAt");

ALTER TABLE "AltaCardReviewRequest" ADD CONSTRAINT "AltaCardReviewRequest_altaCardId_fkey" FOREIGN KEY ("altaCardId") REFERENCES "AltaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewRequest" ADD CONSTRAINT "AltaCardReviewRequest_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewRequest" ADD CONSTRAINT "AltaCardReviewRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewRequest" ADD CONSTRAINT "AltaCardReviewRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCardReviewThread" ADD CONSTRAINT "AltaCardReviewThread_reviewRequestId_fkey" FOREIGN KEY ("reviewRequestId") REFERENCES "AltaCardReviewRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewThread" ADD CONSTRAINT "AltaCardReviewThread_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewThread" ADD CONSTRAINT "AltaCardReviewThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewThread" ADD CONSTRAINT "AltaCardReviewThread_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AltaCardReviewThreadMessage" ADD CONSTRAINT "AltaCardReviewThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AltaCardReviewThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AltaCardReviewThreadMessage" ADD CONSTRAINT "AltaCardReviewThreadMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
