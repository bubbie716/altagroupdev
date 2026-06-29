Relationship Intelligence Terminology
=====================================
Date: 2026-06-25

MODEL
-----

Relationship Tier (Standard · Preferred · Premier)
  Score-based standing with Alta. Displayed on the Relationship page,
  dashboard summaries, admin consoles, and progress bars.

Alta Private (invitation-only program)
  Separate from relationship tier. Eligibility is computed; membership
  requires operator activation after invitation acceptance. Customers may
  be Alta Private members without holding a Gold Alta Card.

Alta Card tiers (White · Navy · Black · Gold)
  Card product tiers. Gold remains exclusive to Alta Private members but
  is not required for Alta Private membership.

Relationship Tier ≠ Alta Private

INTERNAL VS CUSTOMER-FACING
---------------------------

Internal codes (unchanged scoring):
  PRIVATE_ELIGIBLE — score/assets threshold for Alta Private eligibility
  PRIVATE_CLIENT   — active Alta Private membership (user tag)

Customer-facing display:
  Relationship tier always maps to Standard, Preferred, or Premier
  Alta Private shown as separate status: Not a Member · Eligible · Active

KEY FILES
---------

- src/lib/bank/relationship-terminology.ts — display helpers
- src/lib/bank/customer-relationship-display.ts — progress bars
- src/lib/bank/relationship-timeline-customer-copy.ts — timeline wording

TIMELINE (Alta Private)
-----------------------

  Alta Private Invitation Sent
  Alta Private Activated
  Welcome to Alta Private.

Never: "Relationship Tier Upgraded to Private"

ADMIN LANGUAGE
--------------

  Send Alta Private invitation review
  Alta Private eligibility / membership
  View Alta Private status

Never: Grant Private · Upgrade to Private · Promote to Private
