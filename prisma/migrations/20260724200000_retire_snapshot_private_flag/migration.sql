-- Retire RelationshipProfileSnapshot.privateBankingEligible.
-- The application no longer writes this column. Adding a default keeps existing
-- rows and any external writers intact while allowing inserts to omit it.
-- Non-destructive: no data is read, moved, or deleted.
ALTER TABLE "RelationshipProfileSnapshot"
  ALTER COLUMN "privateBankingEligible" SET DEFAULT false;
