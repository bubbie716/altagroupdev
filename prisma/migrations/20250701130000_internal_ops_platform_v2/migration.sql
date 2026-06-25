-- AlterEnum
ALTER TYPE "InternalNoteTargetType" ADD VALUE 'BANK_TRANSACTION';
ALTER TYPE "InternalNoteTargetType" ADD VALUE 'ALTA_PAY_PAYMENT';

-- CreateEnum
CREATE TYPE "BankAccountHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN "restrictDeposits" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankAccount" ADD COLUMN "restrictWithdrawals" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BankAccount" ADD COLUMN "restrictTransfers" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BankAccountHold" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BankAccountHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "releasedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "BankAccountHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsJobRun" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccountHold_bankAccountId_idx" ON "BankAccountHold"("bankAccountId");
CREATE INDEX "BankAccountHold_status_idx" ON "BankAccountHold"("status");
CREATE UNIQUE INDEX "OpsJobRun_jobKey_key" ON "OpsJobRun"("jobKey");

-- AddForeignKey
ALTER TABLE "BankAccountHold" ADD CONSTRAINT "BankAccountHold_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankAccountHold" ADD CONSTRAINT "BankAccountHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankAccountHold" ADD CONSTRAINT "BankAccountHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
