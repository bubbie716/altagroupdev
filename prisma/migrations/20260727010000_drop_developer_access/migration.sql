-- Retire DeveloperAccessStatus — Exchange developer API was never shipped.
ALTER TABLE "User" DROP COLUMN IF EXISTS "developerAccessStatus";
DROP TYPE IF EXISTS "DeveloperAccessStatus";

-- Remap legacy Exchange issuer companies to private companies.
UPDATE "Company" SET type = 'PRIVATE_COMPANY' WHERE type = 'ISSUER';
