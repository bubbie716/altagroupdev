import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDepositMilestoneCopy,
  formatRelationshipEstablishedCopy,
  formatRelationshipTierOutcomeCopy,
  polishCustomerTimelineCopy,
  resolveCustomerTimelineCopy,
} from "./relationship-timeline-customer-copy.ts";
import {
  formatAltaCardTierUpgradeTimelineCopy,
  formatLoanApprovedTimelineCopy,
  formatRelationshipTierChangedCustomerCopy,
} from "./relationship-timeline-historical.ts";
import { RELATIONSHIP_TIER_LABELS } from "./relationship-intelligence-config.ts";

describe("relationship timeline customer copy", () => {
  it("uses premium titles for relationship milestones", () => {
    const copy = formatRelationshipEstablishedCopy("personal");
    assert.equal(copy.title, "Relationship Established");
    assert.equal(copy.description, "Your relationship with Alta began.");
  });

  it("describes deposit milestones without database wording", () => {
    const copy = formatDepositMilestoneCopy(50_000, "personal");
    assert.equal(copy.title, "Relationship Milestone Reached");
    assert.match(copy.description ?? "", /total deposits with Alta reached/);
    assert.doesNotMatch(copy.description ?? "", /Crossed|profile history/i);
  });

  it("rewrites legacy milestone rows with crossed descriptions", () => {
    const copy = resolveCustomerTimelineCopy(
      {
        eventType: "DEPOSIT_MILESTONE",
        title: "Lifetime deposits reached ƒ50,000",
        description: "Crossed ƒ50,000 in recorded deposit activity.",
        occurredAt: new Date().toISOString(),
        relatedEntityId: null,
        metadata: { threshold: 50_000 },
      },
      "personal",
    );
    assert.equal(copy.title, "Relationship Milestone Reached");
    assert.match(copy.description ?? "", /total deposits with Alta reached/);
  });

  it("rewrites legacy tier rows without migration language", () => {
    const copy = resolveCustomerTimelineCopy(
      {
        eventType: "RELATIONSHIP_TIER_CHANGED",
        title: "Relationship tier upgraded to Preferred",
        description: "Previously Standard.",
        occurredAt: new Date().toISOString(),
        relatedEntityId: null,
        metadata: { oldTier: "STANDARD", newTier: "PREFERRED" },
      },
      "personal",
    );
    assert.equal(copy.title, "Preferred Status Reached");
    assert.equal(copy.description, "Your relationship now qualifies for Preferred status.");
  });

  it("rewrites legacy stored titles for customer display", () => {
    const copy = resolveCustomerTimelineCopy(
      {
        eventType: "RELATIONSHIP_STARTED",
        title: "Joined Alta",
        description: "Customer relationship with Alta began.",
        occurredAt: new Date().toISOString(),
        relatedEntityId: null,
        metadata: null,
      },
      "personal",
    );
    assert.equal(copy.title, "Relationship Established");
    assert.equal(copy.description, "Your relationship with Alta began.");
  });

  it("describes tier outcomes without migration language", () => {
    const copy = formatRelationshipTierChangedCustomerCopy(
      "STANDARD",
      "PREFERRED",
      RELATIONSHIP_TIER_LABELS,
    );
    assert.equal(copy.title, "Preferred Status Reached");
    assert.equal(copy.description, "Your relationship now qualifies for Preferred status.");
    assert.doesNotMatch(copy.description ?? "", /from Standard|Previously/i);
  });

  it("describes Alta Private as a welcome, not a tier change", () => {
    const copy = formatRelationshipTierOutcomeCopy(
      "PRIVATE_CLIENT",
      RELATIONSHIP_TIER_LABELS,
      "personal",
    );
    assert.equal(copy.title, "Alta Private Activated");
    assert.equal(copy.description, "Welcome to Alta Private.");
  });

  it("describes Alta Card upgrades by outcome only", () => {
    const copy = formatAltaCardTierUpgradeTimelineCopy("navy", "black");
    assert.equal(copy.title, "Alta Card Upgraded");
    assert.equal(copy.description, "Your Alta Card was upgraded to Alta Black.");
    assert.doesNotMatch(copy.description ?? "", /Previously|Upgraded from/i);
  });

  it("describes loan approval without internal details", () => {
    const copy = formatLoanApprovedTimelineCopy(25_000);
    assert.equal(copy.title, "Loan Approved");
    assert.equal(copy.description, "Your loan was approved and funds were made available.");
  });

  it("strips awkward legacy descriptions", () => {
    const copy = polishCustomerTimelineCopy(
      {
        eventType: "ALTA_CARD_TIER_CHANGED",
        title: "Alta Card Upgraded",
        description: "Previously Gold.",
        occurredAt: new Date().toISOString(),
        relatedEntityId: null,
        metadata: { newTier: "black" },
      },
      "personal",
      { title: "Alta Card Upgraded", description: "Previously Gold." },
    );
    assert.equal(copy.description, "Your Alta Card was upgraded to Alta Black.");
  });
});
