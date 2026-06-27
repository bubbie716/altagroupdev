-- Backfill missing applicant sender ids on legacy secure deal room messages.

UPDATE "AltaCardApplicationThreadMessage" AS m
SET "senderUserId" = t."applicantUserId"
FROM "AltaCardApplicationThread" AS t
WHERE m."threadId" = t."id"
  AND m."senderRole" = 'APPLICANT'
  AND m."senderUserId" IS NULL;

UPDATE "AltaCardReviewThreadMessage" AS m
SET "senderUserId" = t."applicantUserId"
FROM "AltaCardReviewThread" AS t
WHERE m."threadId" = t."id"
  AND m."senderRole" = 'APPLICANT'
  AND m."senderUserId" IS NULL;

UPDATE "LoanApplicationThreadMessage" AS m
SET "senderUserId" = t."applicantUserId"
FROM "LoanApplicationThread" AS t
WHERE m."threadId" = t."id"
  AND m."senderRole" = 'APPLICANT'
  AND m."senderUserId" IS NULL;
