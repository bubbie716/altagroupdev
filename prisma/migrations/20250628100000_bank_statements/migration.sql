-- CreateEnum
CREATE TYPE "BankStatementStatus" AS ENUM ('DRAFT', 'GENERATED', 'VOID');

-- CreateTable
CREATE TABLE "BankStatement" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementNumber" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "closingBalance" DECIMAL(18,2) NOT NULL,
    "totalDeposits" DECIMAL(18,2) NOT NULL,
    "totalWithdrawals" DECIMAL(18,2) NOT NULL,
    "totalTransfersIn" DECIMAL(18,2) NOT NULL,
    "totalTransfersOut" DECIMAL(18,2) NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "status" "BankStatementStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankStatement_statementNumber_key" ON "BankStatement"("statementNumber");

-- CreateIndex
CREATE INDEX "BankStatement_bankAccountId_idx" ON "BankStatement"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankStatement_status_idx" ON "BankStatement"("status");

-- CreateIndex
CREATE INDEX "BankStatement_periodStart_periodEnd_idx" ON "BankStatement"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
