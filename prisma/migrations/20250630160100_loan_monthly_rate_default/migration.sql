-- New loans default to monthly rate type (separate migration: enum value must be committed first)
ALTER TABLE "Loan" ALTER COLUMN "interestRateType" SET DEFAULT 'MONTHLY_PERCENT';
