-- Store Discord login handle separately from display name for invitation matching.
ALTER TABLE "User" ADD COLUMN "discordLoginUsername" TEXT;

UPDATE "User" SET "discordLoginUsername" = "discordUsername" WHERE "discordLoginUsername" IS NULL;

CREATE INDEX "User_discordLoginUsername_idx" ON "User"("discordLoginUsername");
