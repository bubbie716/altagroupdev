-- Alta Commercial plan hooks and merchant payment failure notifications

CREATE TYPE "CommercialPlan" AS ENUM ('CORE', 'PRO');
CREATE TYPE "CommercialPlanStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');
CREATE TYPE "CommercialBillingStatus" AS ENUM ('NOT_BILLED', 'CURRENT', 'PAST_DUE');

ALTER TABLE "Company"
  ADD COLUMN "commercialPlan" "CommercialPlan" NOT NULL DEFAULT 'CORE',
  ADD COLUMN "planStatus" "CommercialPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "billingStatus" "CommercialBillingStatus" NOT NULL DEFAULT 'NOT_BILLED',
  ADD COLUMN "commercialMonthlyFee" DECIMAL(18,2),
  ADD COLUMN "commercialEnabledFeatures" JSONB;

ALTER TYPE "UserNotificationType" ADD VALUE 'MERCHANT_PAYMENT_FAILED';
