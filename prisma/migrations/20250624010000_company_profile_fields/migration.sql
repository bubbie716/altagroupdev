-- Company profile fields for creation workflow and workspace pages.
ALTER TABLE "Company" ADD COLUMN "desiredTicker" TEXT;
ALTER TABLE "Company" ADD COLUMN "description" TEXT;
ALTER TABLE "Company" ADD COLUMN "headquarters" TEXT;
ALTER TABLE "Company" ADD COLUMN "primaryContactDiscordUsername" TEXT;
ALTER TABLE "Company" ADD COLUMN "intendedUses" TEXT[] DEFAULT ARRAY[]::TEXT[];
