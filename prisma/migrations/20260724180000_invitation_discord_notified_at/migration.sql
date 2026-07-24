-- Backfill invitation Discord delivery timestamps expected by Prisma schema.
-- Safe / idempotent: only adds columns when missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CompanyInvitation'
      AND column_name = 'discordNotifiedAt'
  ) THEN
    ALTER TABLE "CompanyInvitation" ADD COLUMN "discordNotifiedAt" TIMESTAMP(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'AltaPrivateInvitation'
      AND column_name = 'discordNotifiedAt'
  ) THEN
    ALTER TABLE "AltaPrivateInvitation" ADD COLUMN "discordNotifiedAt" TIMESTAMP(3);
  END IF;
END $$;
