-- Extend UserTag enum for Alta permission system (no new tables).
ALTER TYPE "UserTag" ADD VALUE 'OPERATOR';
ALTER TYPE "UserTag" ADD VALUE 'DEVELOPER';
ALTER TYPE "UserTag" ADD VALUE 'ISSUER';
