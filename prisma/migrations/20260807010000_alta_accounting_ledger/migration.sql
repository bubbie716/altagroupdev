-- Accounting Tracker (private corporate-admin books — local orgs, not Alta Company)

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

CREATE TABLE "AccountingCategory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingCounterparty" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCounterparty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingLedgerEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "counterpartyId" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingCategory_orgId_name_key" ON "AccountingCategory"("orgId", "name");
CREATE INDEX "AccountingCategory_orgId_idx" ON "AccountingCategory"("orgId");

CREATE UNIQUE INDEX "AccountingCounterparty_orgId_name_key" ON "AccountingCounterparty"("orgId", "name");
CREATE INDEX "AccountingCounterparty_orgId_idx" ON "AccountingCounterparty"("orgId");

CREATE INDEX "AccountingLedgerEntry_orgId_date_idx" ON "AccountingLedgerEntry"("orgId", "date");
CREATE INDEX "AccountingLedgerEntry_categoryId_idx" ON "AccountingLedgerEntry"("categoryId");
CREATE INDEX "AccountingLedgerEntry_counterpartyId_idx" ON "AccountingLedgerEntry"("counterpartyId");

ALTER TABLE "AccountingCategory" ADD CONSTRAINT "AccountingCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccountingOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingCounterparty" ADD CONSTRAINT "AccountingCounterparty_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccountingOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "AccountingOrg"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccountingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "AccountingCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
