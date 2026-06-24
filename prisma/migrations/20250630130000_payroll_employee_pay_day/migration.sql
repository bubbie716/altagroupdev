-- AlterTable
ALTER TABLE "PayrollEmployee" ADD COLUMN "payDay" TEXT;
ALTER TABLE "PayrollEmployee" ADD COLUMN "nextPayDate" TIMESTAMP(3);
ALTER TABLE "PayrollEmployee" ADD COLUMN "lastPaidAt" TIMESTAMP(3);

UPDATE "PayrollEmployee" SET "payDay" = 'first_of_month' WHERE "payDay" IS NULL;
UPDATE "PayrollEmployee" SET "accountNumber" = 'AB-0000-000000' WHERE "accountNumber" IS NULL;

ALTER TABLE "PayrollEmployee" ALTER COLUMN "payDay" SET NOT NULL;
ALTER TABLE "PayrollEmployee" ALTER COLUMN "accountNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN "autoEmployeeId" TEXT;

-- CreateIndex
CREATE INDEX "PayrollEmployee_nextPayDate_idx" ON "PayrollEmployee"("nextPayDate");
CREATE INDEX "PayrollRun_autoEmployeeId_idx" ON "PayrollRun"("autoEmployeeId");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_autoEmployeeId_fkey" FOREIGN KEY ("autoEmployeeId") REFERENCES "PayrollEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
