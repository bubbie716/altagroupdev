-- Separate Alta Private invitation from score-based eligibility on the relationship timeline.

ALTER TYPE "RelationshipTimelineEventType" ADD VALUE 'ALTA_PRIVATE_INVITED';
