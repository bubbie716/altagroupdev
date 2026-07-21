-- Sprint 4D: certification TEST account identifiers on participant connector

ALTER TABLE "NccParticipantConnector"
  ADD COLUMN IF NOT EXISTS "certSourceAccountIdentifier" TEXT,
  ADD COLUMN IF NOT EXISTS "certDestinationAccountIdentifier" TEXT;
