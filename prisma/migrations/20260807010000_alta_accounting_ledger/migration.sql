-- Alta Accounting (private corporate-admin cash-basis books)

CREATE TABLE "AccountingCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingCounterparty" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingCounterparty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountingLedgerEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
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

CREATE UNIQUE INDEX "AccountingCategory_companyId_name_key" ON "AccountingCategory"("companyId", "name");
CREATE INDEX "AccountingCategory_companyId_idx" ON "AccountingCategory"("companyId");

CREATE UNIQUE INDEX "AccountingCounterparty_companyId_name_key" ON "AccountingCounterparty"("companyId", "name");
CREATE INDEX "AccountingCounterparty_companyId_idx" ON "AccountingCounterparty"("companyId");

CREATE INDEX "AccountingLedgerEntry_companyId_date_idx" ON "AccountingLedgerEntry"("companyId", "date");
CREATE INDEX "AccountingLedgerEntry_categoryId_idx" ON "AccountingLedgerEntry"("categoryId");
CREATE INDEX "AccountingLedgerEntry_counterpartyId_idx" ON "AccountingLedgerEntry"("counterpartyId");

ALTER TABLE "AccountingCategory" ADD CONSTRAINT "AccountingCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingCounterparty" ADD CONSTRAINT "AccountingCounterparty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccountingCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingLedgerEntry" ADD CONSTRAINT "AccountingLedgerEntry_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "AccountingCounterparty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
