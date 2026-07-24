-- Shrink UserTag to ADMIN + PRIVATE_CLIENT only.
-- Promote operators who still need internal access, then drop deprecated assignments.

INSERT INTO "UserTagAssignment" ("userId", "tag")
SELECT "userId", 'ADMIN'::"UserTag"
FROM "UserTagAssignment"
WHERE "tag" = 'OPERATOR'
ON CONFLICT DO NOTHING;

DELETE FROM "UserTagAssignment"
WHERE "tag" IN ('OPERATOR', 'DEVELOPER', 'ISSUER', 'SYSTEM');

-- Postgres cannot DROP enum values; recreate the type.
CREATE TYPE "UserTag_new" AS ENUM ('ADMIN', 'PRIVATE_CLIENT');

ALTER TABLE "UserTagAssignment"
  ALTER COLUMN "tag" TYPE "UserTag_new"
  USING ("tag"::text::"UserTag_new");

DROP TYPE "UserTag";
ALTER TYPE "UserTag_new" RENAME TO "UserTag";
