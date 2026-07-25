Relationship Intelligence Terminology
=====================================
Date: 2026-07-24

MODEL
-----

Relationship Tier (Standard · Preferred · Premier)
  Score-based standing with Alta. Displayed on the Relationship page,
  dashboard summaries, admin consoles, and progress bars.

Alta Card tiers (White · Navy · Black · Gold)
  Card product tiers, independent of relationship tier. Gold is available to
  any Alta Card applicant with negotiated limit and rate set on review.

LEGACY STORED CODES
-------------------

`PRIVATE_ELIGIBLE` and `PRIVATE_CLIENT` still exist as `RelationshipTierCode`
values on historical rows. They carry no application meaning: nothing writes
them, and display helpers collapse them to Premier. See
`isLegacyStoredTier()` in `src/lib/bank/relationship-terminology.ts`.

KEY FILES
---------

- src/lib/bank/relationship-terminology.ts — display helpers
- src/lib/bank/customer-relationship-display.ts — progress bars
- src/lib/bank/relationship-timeline-customer-copy.ts — timeline wording

CUSTOMER-FACING DISPLAY
-----------------------

Relationship tier always maps to Standard, Preferred, or Premier.

Never: "Relationship Tier Upgraded to Private"
