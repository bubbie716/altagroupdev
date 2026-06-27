-- Dedicated SYSTEM tag for cron / scheduler audit attribution (not a human admin).
ALTER TYPE "UserTag" ADD VALUE IF NOT EXISTS 'SYSTEM';
