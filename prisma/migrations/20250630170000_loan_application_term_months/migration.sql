-- Loan term in months (application + approved loan snapshot)
ALTER TABLE "LoanApplication" ADD COLUMN "termMonths" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Loan" ADD COLUMN "termMonths" INTEGER;
