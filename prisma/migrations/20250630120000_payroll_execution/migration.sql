-- AlterEnum
ALTER TYPE "PayrollRunStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailureReason" TEXT,
ADD COLUMN "lastRunAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PayrollRunExecution" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "scheduledRunAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledTransferExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRunExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunLineExecution" (
    "id" TEXT NOT NULL,
    "payrollRunExecutionId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "ScheduledTransferExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "bankTransactionId" TEXT,
    "failureReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRunLineExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_payDate_idx" ON "PayrollRun"("payDate");
CREATE INDEX "PayrollRunExecution_payrollRunId_idx" ON "PayrollRunExecution"("payrollRunId");
CREATE INDEX "PayrollRunExecution_status_idx" ON "PayrollRunExecution"("status");
CREATE INDEX "PayrollRunExecution_scheduledRunAt_idx" ON "PayrollRunExecution"("scheduledRunAt");
CREATE UNIQUE INDEX "PayrollRunExecution_payrollRunId_scheduledRunAt_key" ON "PayrollRunExecution"("payrollRunId", "scheduledRunAt");
CREATE INDEX "PayrollRunLineExecution_payrollRunExecutionId_idx" ON "PayrollRunLineExecution"("payrollRunExecutionId");
CREATE INDEX "PayrollRunLineExecution_status_idx" ON "PayrollRunLineExecution"("status");
CREATE UNIQUE INDEX "PayrollRunLineExecution_payrollRunExecutionId_employeeId_key" ON "PayrollRunLineExecution"("payrollRunExecutionId", "employeeId");

-- AddForeignKey
ALTER TABLE "PayrollRunExecution" ADD CONSTRAINT "PayrollRunExecution_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRunLineExecution" ADD CONSTRAINT "PayrollRunLineExecution_payrollRunExecutionId_fkey" FOREIGN KEY ("payrollRunExecutionId") REFERENCES "PayrollRunExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollRunLineExecution" ADD CONSTRAINT "PayrollRunLineExecution_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
