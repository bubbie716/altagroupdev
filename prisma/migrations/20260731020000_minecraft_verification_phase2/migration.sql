-- Unified onboarding Phase 2: Minecraft verification challenges.
-- Forward-only. Does not backfill minecraftVerifiedAt or onboardingCompletedAt.
-- Existing minecraftUsername values remain unverified profile claims.

CREATE TYPE "MinecraftChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'REPLACED');

CREATE TABLE "MinecraftVerificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedUsername" TEXT NOT NULL,
    "targetWorld" TEXT NOT NULL DEFAULT 'world',
    "targetX" INTEGER NOT NULL,
    "targetZ" INTEGER NOT NULL,
    "status" "MinecraftChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "regenerationCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinecraftVerificationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MinecraftVerificationChallenge_userId_status_idx"
  ON "MinecraftVerificationChallenge"("userId", "status");
CREATE INDEX "MinecraftVerificationChallenge_expiresAt_idx"
  ON "MinecraftVerificationChallenge"("expiresAt");
CREATE INDEX "MinecraftVerificationChallenge_userId_createdAt_idx"
  ON "MinecraftVerificationChallenge"("userId", "createdAt");

ALTER TABLE "MinecraftVerificationChallenge"
  ADD CONSTRAINT "MinecraftVerificationChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
