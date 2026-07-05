-- Admin-granted Commercial Pro with expiry

CREATE TYPE "CommercialProGrantSource" AS ENUM ('PURCHASED', 'ADMIN_GRANT');

ALTER TABLE "Company"
  ADD COLUMN "commercialProGrantSource" "CommercialProGrantSource",
  ADD COLUMN "commercialProExpiresAt" TIMESTAMP(3);

CREATE INDEX "Company_commercialProExpiresAt_idx" ON "Company"("commercialProExpiresAt");

ALTER TYPE "UserNotificationType" ADD VALUE 'COMMERCIAL_PRO_ADMIN_GRANTED';
