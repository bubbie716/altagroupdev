import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDepositMilestoneCopy,
  extractBankAccountName,
  formatAltaPrivateInvitedCopy,
  formatBankAccountOpenedCopy,
  formatPrivateBankingClientCopy,
  formatPrivateBankingEligibleCopy,
  formatRelationshipEstablishedCopy,
  formatRelationshipTierOutcomeCopy,
  polishCustomerTimelineCopy,
  resolveCustomerTimelineCopy,
} from "./relationship-timeline-customer-copy.ts";
import {
  formatAltaCardLimitIncreaseTimelineCopy,
  formatAltaCardRateReductionTimelineCopy,
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

  it("separates Alta Private invitation from score-based eligibility", () => {
    const invited = formatAltaPrivateInvitedCopy("personal");
    assert.equal(invited.title, "Invited to Alta Private");
    assert.equal(invited.description, "You were invited to join Alta Private.");

    const eligible = formatPrivateBankingEligibleCopy("personal");
    assert.equal(eligible.title, "Eligible for Alta Private");
    assert.equal(eligible.description, "You may qualify for Alta Private over time.");

    const activated = formatPrivateBankingClientCopy("personal");
    assert.equal(activated.title, "Alta Private Activated");
  });

  it("rewrites legacy invitation-sent rows to the invited copy", () => {
    const copy = resolveCustomerTimelineCopy(
      {
        eventType: "ALTA_PRIVATE_INVITED",
        title: "Alta Private Invitation Sent",
        description: "You are now eligible to join Alta Private.",
        occurredAt: new Date().toISOString(),
        relatedEntityId: "inv-1",
        metadata: null,
      },
      "personal",
    );
    assert.equal(copy.title, "Invited to Alta Private");
    assert.equal(copy.description, "You were invited to join Alta Private.");
  });

  it("describes Alta Card upgrades by outcome only", () => {
    const copy = formatAltaCardTierUpgradeTimelineCopy("navy", "black");
    assert.equal(copy.title, "Alta Card Upgraded");
    assert.equal(copy.description, "Your Alta Card was upgraded to Alta Black.");
    assert.doesNotMatch(copy.description ?? "", /Previously|Upgraded from/i);
  });

  it("describes Alta Card limit increases by outcome only", () => {
    const copy = formatAltaCardLimitIncreaseTimelineCopy(12_500, 17_500);
    assert.equal(copy.title, "Alta Card Limit Increased");
    assert.match(copy.description ?? "", /12,500/);
    assert.match(copy.description ?? "", /17,500/);
    assert.doesNotMatch(copy.description ?? "", /Previous limit/i);
  });

  it("describes Alta Card rate reductions by outcome only", () => {
    const copy = formatAltaCardRateReductionTimelineCopy(24.99, 19.99);
    assert.equal(copy.title, "Alta Card Rate Reduced");
    assert.match(copy.description ?? "", /24\.99%/);
    assert.match(copy.description ?? "", /19\.99%/);
    assert.doesNotMatch(copy.description ?? "", /Previous rate/i);
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

  it("repairs corrupted bank account opened descriptions from refresh loops", () => {
    const corrupted =
      "Your Your Your Your Your 12700k MM is now active. is now active. is now active. is now active. is now active.";
    const copy = resolveCustomerTimelineCopy(
      {
        eventType: "BANK_ACCOUNT_OPENED",
        title: "Bank Account Opened",
        description: corrupted,
        occurredAt: new Date().toISOString(),
        relatedEntityId: null,
        metadata: null,
      },
      "personal",
    );
    assert.equal(copy.title, "Bank Account Opened");
    assert.equal(copy.description, "Your 12700k MM account is now active.");
  });

  it("extractBankAccountName prefers metadata and unwraps nested copy", () => {
    assert.equal(extractBankAccountName("12700k MM"), "12700k MM");
    assert.equal(
      extractBankAccountName("Your Your 12700k MM is now active. is now active.", {
        accountName: "12700k MM",
      }),
      "12700k MM",
    );
    assert.equal(
      extractBankAccountName("Your Your 12700k Private MM is now active. is now active."),
      "12700k Private MM",
    );
  });

  it("bank account opened copy is idempotent across repeated formatting", () => {
    const first = formatBankAccountOpenedCopy("12700k MM", "personal");
    const second = formatBankAccountOpenedCopy(first.description, "personal", {
      accountName: "12700k MM",
    });
    assert.equal(first.description, second.description);
  });
});
