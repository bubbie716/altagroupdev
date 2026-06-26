-- CreateEnum
CREATE TYPE "LoanApplicationThreadStatus" AS ENUM ('OPEN', 'WAITING_ON_APPLICANT', 'WAITING_ON_ALTA', 'CLOSED');

-- CreateEnum
CREATE TYPE "LoanApplicationThreadSenderRole" AS ENUM ('APPLICANT', 'ALTA_STAFF', 'SYSTEM');

-- CreateTable
CREATE TABLE "LoanApplicationThread" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "companyId" TEXT,
    "status" "LoanApplicationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "assignedStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "LoanApplicationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanApplicationThreadMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole" "LoanApplicationThreadSenderRole" NOT NULL,
    "body" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LoanApplicationThreadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplicationThread_loanApplicationId_key" ON "LoanApplicationThread"("loanApplicationId");

-- CreateIndex
CREATE INDEX "LoanApplicationThread_applicantUserId_idx" ON "LoanApplicationThread"("applicantUserId");

-- CreateIndex
CREATE INDEX "LoanApplicationThread_companyId_idx" ON "LoanApplicationThread"("companyId");

-- CreateIndex
CREATE INDEX "LoanApplicationThread_status_idx" ON "LoanApplicationThread"("status");

-- CreateIndex
CREATE INDEX "LoanApplicationThread_assignedStaffId_idx" ON "LoanApplicationThread"("assignedStaffId");

-- CreateIndex
CREATE INDEX "LoanApplicationThreadMessage_threadId_createdAt_idx" ON "LoanApplicationThreadMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoanApplicationThread" ADD CONSTRAINT "LoanApplicationThread_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplicationThread" ADD CONSTRAINT "LoanApplicationThread_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplicationThread" ADD CONSTRAINT "LoanApplicationThread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplicationThread" ADD CONSTRAINT "LoanApplicationThread_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplicationThreadMessage" ADD CONSTRAINT "LoanApplicationThreadMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "LoanApplicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplicationThreadMessage" ADD CONSTRAINT "LoanApplicationThreadMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
