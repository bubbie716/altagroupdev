-- Relationship Intelligence V3 — Timeline events

CREATE TYPE "RelationshipTimelineEventType" AS ENUM (
  'RELATIONSHIP_STARTED',
  'BANK_ACCOUNT_OPENED',
  'BUSINESS_ACCOUNT_OPENED',
  'DEPOSIT_MILESTONE',
  'WITHDRAWAL_MILESTONE',
  'ALTA_PAY_MILESTONE',
  'ALTA_CARD_OPENED',
  'ALTA_CARD_TIER_CHANGED',
  'ALTA_CARD_LIMIT_CHANGED',
  'ALTA_CARD_PAID_ON_TIME',
  'ALTA_CARD_DELINQUENT',
  'LOAN_APPLICATION_SUBMITTED',
  'LOAN_ACCEPTED',
  'LOAN_DENIED',
  'LOAN_FUNDED',
  'LOAN_PAYMENT_MADE',
  'LOAN_PAID_OFF',
  'PRIVATE_BANKING_ELIGIBLE',
  'PRIVATE_BANKING_CLIENT',
  'RELATIONSHIP_SCORE_CHANGED',
  'RELATIONSHIP_TIER_CHANGED',
  'MANUAL_NOTE'
);

CREATE TABLE "RelationshipTimelineEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "profileId" TEXT,
  "eventType" "RelationshipTimelineEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "relatedEntityType" TEXT,
  "relatedEntityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RelationshipTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RelationshipTimelineEvent_userId_occurredAt_idx" ON "RelationshipTimelineEvent"("userId", "occurredAt");
CREATE INDEX "RelationshipTimelineEvent_profileId_idx" ON "RelationshipTimelineEvent"("profileId");
CREATE INDEX "RelationshipTimelineEvent_eventType_idx" ON "RelationshipTimelineEvent"("eventType");
CREATE INDEX "RelationshipTimelineEvent_relatedEntityType_relatedEntityId_idx" ON "RelationshipTimelineEvent"("relatedEntityType", "relatedEntityId");

ALTER TABLE "RelationshipTimelineEvent" ADD CONSTRAINT "RelationshipTimelineEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipTimelineEvent" ADD CONSTRAINT "RelationshipTimelineEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RelationshipProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
