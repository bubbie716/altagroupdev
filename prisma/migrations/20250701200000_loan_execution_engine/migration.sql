-- Loan execution provenance (agreement is source of truth after execution)
ALTER TABLE "Loan" ADD COLUMN "sourceDealRoomId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "sourceAgreementId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "sourceAgreementDraftId" TEXT;
ALTER TABLE "Loan" ADD COLUMN "disbursementReferenceCode" TEXT;
ALTER TABLE "Loan" ADD COLUMN "collateralDescription" TEXT;
ALTER TABLE "Loan" ADD COLUMN "paymentFrequencyLabel" TEXT;
ALTER TABLE "Loan" ADD COLUMN "minimumPayment" DECIMAL(18,2);
ALTER TABLE "Loan" ADD COLUMN "maturityDate" TIMESTAMP(3);
ALTER TABLE "Loan" ADD COLUMN "firstPaymentDueDate" TIMESTAMP(3);

CREATE UNIQUE INDEX "Loan_sourceDealRoomId_key" ON "Loan"("sourceDealRoomId");
CREATE UNIQUE INDEX "Loan_sourceAgreementDraftId_key" ON "Loan"("sourceAgreementDraftId");
