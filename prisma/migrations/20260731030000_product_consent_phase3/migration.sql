-- Unified onboarding Phase 3: progressive product consent + company consent subjects.
-- Forward-only. Does not backfill product acceptances from account ownership.
-- Backfills existing Phase 1/2 LegalAcceptance rows as USER-subject acceptances.
-- Does not rewrite acceptance history. Append-only active uniqueness via partial index.

ALTER TYPE "LegalConsentScope" ADD VALUE IF NOT EXISTS 'ALTA_PAY';

CREATE TYPE "LegalConsentSubjectType" AS ENUM ('USER', 'COMPANY');

ALTER TABLE "LegalAcceptance"
  ADD COLUMN "subjectType" "LegalConsentSubjectType",
  ADD COLUMN "subjectKey" TEXT,
  ADD COLUMN "companyId" TEXT;

-- Backfill existing rows as user-scoped acceptances (actor remains userId).
UPDATE "LegalAcceptance"
SET
  "subjectType" = 'USER',
  "subjectKey" = 'user:' || "userId"
WHERE "subjectType" IS NULL OR "subjectKey" IS NULL;

ALTER TABLE "LegalAcceptance"
  ALTER COLUMN "subjectType" SET NOT NULL,
  ALTER COLUMN "subjectKey" SET NOT NULL;

-- Replace user-centric uniqueness with subject-centric append-only active uniqueness.
DROP INDEX IF EXISTS "LegalAcceptance_userId_documentId_documentVersion_acceptanceType_key";

-- Only one *active* acceptance per subject/document/version/type/hash.
-- Historical superseded/withdrawn rows may share the same logical identity.
CREATE UNIQUE INDEX "LegalAcceptance_active_subject_document_version_type_hash_key"
  ON "LegalAcceptance" ("subjectKey", "documentId", "documentVersion", "acceptanceType", "contentHash")
  WHERE "supersededAt" IS NULL AND "withdrawnAt" IS NULL;

CREATE INDEX "LegalAcceptance_subjectKey_idx" ON "LegalAcceptance"("subjectKey");
CREATE INDEX "LegalAcceptance_subjectType_idx" ON "LegalAcceptance"("subjectType");
CREATE INDEX "LegalAcceptance_companyId_idx" ON "LegalAcceptance"("companyId");
CREATE INDEX "LegalAcceptance_subjectKey_consentScope_idx" ON "LegalAcceptance"("subjectKey", "consentScope");
CREATE INDEX "LegalAcceptance_actor_userId_consentScope_idx" ON "LegalAcceptance"("userId", "consentScope");

ALTER TABLE "LegalAcceptance"
  ADD CONSTRAINT "LegalAcceptance_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
