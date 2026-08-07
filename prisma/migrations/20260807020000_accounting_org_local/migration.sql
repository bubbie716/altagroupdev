-- Move accounting ledger from Alta Company FKs to local AccountingOrg.

CREATE TABLE "AccountingOrg" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingOrg_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountingOrg_name_idx" ON "AccountingOrg"("name");
CREATE INDEX "AccountingOrg_createdByUserId_idx" ON "AccountingOrg"("createdByUserId");

ALTER TABLE "AccountingCategory" DROP CONSTRAINT "AccountingCategory_companyId_fkey";
ALTER TABLE "AccountingCounterparty" DROP CONSTRAINT "AccountingCounterparty_companyId_fkey";
ALTER TABLE "AccountingLedgerEntry" DROP CONSTRAINT "AccountingLedgerEntry_companyId_fkey";

DROP INDEX "AccountingCategory_companyId_name_key";
DROP INDEX "AccountingCategory_companyId_idx";
DROP INDEX "AccountingCounterparty_companyId_name_key";
DROP INDEX "AccountingCounterparty_companyId_idx";
DROP INDEX "AccountingLedgerEntry_companyId_date_idx";

ALTER TABLE "AccountingCategory" RENAME COLUMN "companyId" TO "orgId";
ALTER TABLE "AccountingCounterparty" RENAME COLUMN "companyId" TO "orgId";
ALTER TABLE "AccountingLedgerEntry" RENAME COLUMN "companyId" TO "orgId";

CREATE UNIQUE INDEX "AccountingCategory_orgId_name_key" ON "AccountingCategory"("orgId", "name");
CREATE INDEX "AccountingCategory_orgId_idx" ON "AccountingCategory"("orgId");
CREATE UNIQUE INDEX "AccountingCounterparty_orgId_name_key" ON "AccountingCounterparty"("orgId", "name");
CREATE INDEX "AccountingCounterparty_orgId_idx" ON "AccountingCounterparty"("orgId");
CREATE INDEX "AccountingLedgerEntry_orgId_date_idx" ON "AccountingLedgerEntry"("orgId", "date");

ALTER TABLE "AccountingCategory" ADD CONSTRAINT "AccountingCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccountingOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingCounterparty" ADD CONSTRAINT "AccountingCounterparty_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccountingOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccountingOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
