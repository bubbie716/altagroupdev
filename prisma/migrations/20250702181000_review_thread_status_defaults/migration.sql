-- Reset open account review deal rooms to waiting on Alta unless awaiting cardholder input.

UPDATE "AltaCardReviewThread" AS t
SET "status" = 'WAITING_ON_ALTA'
FROM "AltaCardReviewRequest" AS r
WHERE t."reviewRequestId" = r."id"
  AND t."status" NOT IN ('CLOSED')
  AND r."status" NOT IN ('DENIED', 'APPROVED', 'PARTIALLY_APPROVED', 'CANCELLED', 'NEEDS_INFORMATION');

UPDATE "AltaCardReviewThread" AS t
SET "status" = 'WAITING_ON_APPLICANT'
FROM "AltaCardReviewRequest" AS r
WHERE t."reviewRequestId" = r."id"
  AND t."status" NOT IN ('CLOSED')
  AND r."status" = 'NEEDS_INFORMATION';
