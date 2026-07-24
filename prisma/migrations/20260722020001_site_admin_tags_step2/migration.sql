-- Migrate ADMIN → CORPORATE_ADMIN, then shrink UserTag enum.

INSERT INTO "UserTagAssignment" ("userId", "tag")
SELECT "userId", 'CORPORATE_ADMIN'::"UserTag"
FROM "UserTagAssignment"
WHERE "tag" = 'ADMIN'
ON CONFLICT DO NOTHING;

DELETE FROM "UserTagAssignment"
WHERE "tag" = 'ADMIN';

CREATE TYPE "UserTag_new" AS ENUM (
  'CORPORATE_ADMIN',
  'BANK_ADMIN',
  'TERMINAL_ADMIN',
  'PRIVATE_CLIENT'
);

ALTER TABLE "UserTagAssignment"
  ALTER COLUMN "tag" TYPE "UserTag_new"
  USING ("tag"::text::"UserTag_new");

DROP TYPE "UserTag";
ALTER TYPE "UserTag_new" RENAME TO "UserTag";
