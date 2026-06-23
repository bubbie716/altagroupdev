-- CreateEnum
CREATE TYPE "UserTag" AS ENUM ('ADMIN', 'PRIVATE_CLIENT');

-- CreateTable
CREATE TABLE "UserTagAssignment" (
    "userId" TEXT NOT NULL,
    "tag" "UserTag" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTagAssignment_pkey" PRIMARY KEY ("userId","tag")
);

-- Migrate admin tag from globalRole
INSERT INTO "UserTagAssignment" ("userId", "tag")
SELECT "id", 'ADMIN'::"UserTag"
FROM "User"
WHERE "globalRole" = 'ADMIN';

-- Migrate private client tag from globalRole or privateClientStatus
INSERT INTO "UserTagAssignment" ("userId", "tag")
SELECT "id", 'PRIVATE_CLIENT'::"UserTag"
FROM "User"
WHERE "globalRole" = 'PRIVATE_CLIENT'
   OR "privateClientStatus" IN ('ACTIVE', 'INVITED')
ON CONFLICT DO NOTHING;

-- DropForeignKey (none on these columns)

-- AlterTable
ALTER TABLE "User" DROP COLUMN "globalRole",
DROP COLUMN "privateClientStatus";

-- DropEnum
DROP TYPE "GlobalRole";
DROP TYPE "PrivateClientStatus";

-- AddForeignKey
ALTER TABLE "UserTagAssignment" ADD CONSTRAINT "UserTagAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "UserTagAssignment_tag_idx" ON "UserTagAssignment"("tag");
