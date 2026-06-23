-- Revert discordLoginUsername (not needed).
DROP INDEX IF EXISTS "User_discordLoginUsername_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "discordLoginUsername";
