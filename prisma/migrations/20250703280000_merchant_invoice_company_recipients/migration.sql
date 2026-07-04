-- Allow merchant invoices to companies (B2B)

ALTER TABLE "MerchantInvoice" ALTER COLUMN "recipientUserId" DROP NOT NULL;

ALTER TABLE "MerchantInvoice" ADD COLUMN "recipientCompanyId" TEXT;

ALTER TABLE "MerchantInvoice"
  ADD CONSTRAINT "MerchantInvoice_recipientCompanyId_fkey"
  FOREIGN KEY ("recipientCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "MerchantInvoice_recipientCompanyId_status_idx"
  ON "MerchantInvoice"("recipientCompanyId", "status");
