-- CreateEnum
CREATE TYPE "DealRoomStatus" AS ENUM (
  'UNDER_REVIEW',
  'NEGOTIATING_TERMS',
  'AWAITING_APPLICANT',
  'AWAITING_OFFICER',
  'CONTRACT_DRAFTING',
  'READY_FOR_ACCEPTANCE',
  'ACCEPTED',
  'APPROVED',
  'DECLINED',
  'CLOSED'
);

-- CreateEnum
CREATE TYPE "DealRoomParticipantRole" AS ENUM (
  'APPLICANT',
  'COMPANY_REPRESENTATIVE',
  'LOAN_OFFICER',
  'ADMIN_OBSERVER'
);

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'DEAL_ROOM';

-- CreateTable
CREATE TABLE "DealRoom" (
  "id" TEXT NOT NULL,
  "loanApplicationId" TEXT,
  "borrowerUserId" TEXT NOT NULL,
  "companyId" TEXT,
  "assignedOfficerId" TEXT,
  "status" "DealRoomStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "currentRequestedAmount" DECIMAL(18,2) NOT NULL,
  "currentProposedAmount" DECIMAL(18,2),
  "currentProposedRate" DECIMAL(8,4),
  "currentProposedTermMonths" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),

  CONSTRAINT "DealRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealRoomParticipant" (
  "id" TEXT NOT NULL,
  "dealRoomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "DealRoomParticipantRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealRoomParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealRoom_loanApplicationId_key" ON "DealRoom"("loanApplicationId");

-- CreateIndex
CREATE INDEX "DealRoom_borrowerUserId_idx" ON "DealRoom"("borrowerUserId");

-- CreateIndex
CREATE INDEX "DealRoom_companyId_idx" ON "DealRoom"("companyId");

-- CreateIndex
CREATE INDEX "DealRoom_assignedOfficerId_idx" ON "DealRoom"("assignedOfficerId");

-- CreateIndex
CREATE INDEX "DealRoom_status_idx" ON "DealRoom"("status");

-- CreateIndex
CREATE INDEX "DealRoom_createdAt_idx" ON "DealRoom"("createdAt");

-- CreateIndex
CREATE INDEX "DealRoomParticipant_dealRoomId_idx" ON "DealRoomParticipant"("dealRoomId");

-- CreateIndex
CREATE INDEX "DealRoomParticipant_userId_idx" ON "DealRoomParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DealRoomParticipant_dealRoomId_userId_role_key" ON "DealRoomParticipant"("dealRoomId", "userId", "role");

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_borrowerUserId_fkey" FOREIGN KEY ("borrowerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoom" ADD CONSTRAINT "DealRoom_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomParticipant" ADD CONSTRAINT "DealRoomParticipant_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealRoomParticipant" ADD CONSTRAINT "DealRoomParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
