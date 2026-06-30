import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customerTimelineSemanticKey,
  dedupeCustomerTimelineRows,
  shouldIncludeCustomerTimelineRow,
} from "./relationship-timeline-customer-view.ts";

describe("relationship timeline customer view", () => {
  it("hides Alta Private tier changes in favor of program events", () => {
    assert.equal(
      shouldIncludeCustomerTimelineRow({
        id: "1",
        eventType: "RELATIONSHIP_TIER_CHANGED",
        title: "Alta Private Invitation Sent",
        description: null,
        occurredAt: "2026-01-01T00:00:00.000Z",
        metadata: { newTier: "PRIVATE_ELIGIBLE", oldTier: "PREMIER" },
      }),
      false,
    );
  });

  it("collapses duplicate tier transitions with different dedupe keys", () => {
    const rows = dedupeCustomerTimelineRows([
      {
        id: "audit",
        eventType: "RELATIONSHIP_TIER_CHANGED",
        title: "Preferred Status Reached",
        description: "Your relationship now qualifies for Preferred status.",
        occurredAt: "2026-03-01T12:00:00.000Z",
        createdAt: "2026-03-02T00:00:00.000Z",
        metadata: {
          dedupeKey: "audit:relationship-tier:abc",
          oldTier: "STANDARD",
          newTier: "PREFERRED",
        },
      },
      {
        id: "live",
        eventType: "RELATIONSHIP_TIER_CHANGED",
        title: "Preferred Status Reached",
        description: "Your relationship now qualifies for Preferred status.",
        occurredAt: "2026-03-01T12:00:00.000Z",
        createdAt: "2026-03-01T12:00:00.000Z",
        metadata: {
          dedupeKey: "tier:STANDARD->PREFERRED",
          oldTier: "STANDARD",
          newTier: "PREFERRED",
        },
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "live");
  });

  it("keeps distinct milestones by kind and threshold", () => {
    assert.notEqual(
      customerTimelineSemanticKey({
        id: "a",
        eventType: "DEPOSIT_MILESTONE",
        title: "Relationship Milestone Reached",
        description: null,
        occurredAt: "2026-02-01T00:00:00.000Z",
        metadata: { milestoneKind: "DEPOSITS", threshold: 50_000 },
      }),
      customerTimelineSemanticKey({
        id: "b",
        eventType: "DEPOSIT_MILESTONE",
        title: "Relationship Milestone Reached",
        description: null,
        occurredAt: "2026-02-01T00:00:00.000Z",
        metadata: { milestoneKind: "TOTAL_ALTA_ASSETS", threshold: 50_000 },
      }),
    );
  });

  it("collapses duplicate loan approval rows with mixed dedupe metadata", () => {
    const rows = dedupeCustomerTimelineRows([
      {
        id: "synced",
        eventType: "LOAN_FUNDED",
        title: "Loan Approved",
        description: "Your loan was approved and funds were made available.",
        occurredAt: "2026-06-01T12:00:00.000Z",
        createdAt: "2026-06-02T00:00:00.000Z",
        relatedEntityId: "loan-1",
        metadata: { dedupeKey: "loan:funded:loan-1" },
      },
      {
        id: "legacy",
        eventType: "LOAN_FUNDED",
        title: "Loan approved (ƒ12,500)",
        description: null,
        occurredAt: "2026-06-01T12:00:00.000Z",
        createdAt: "2026-06-01T12:00:00.000Z",
        relatedEntityId: "loan-1",
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "legacy");
  });

  it("sorts newest events first with stable tie-breakers", () => {
    const rows = dedupeCustomerTimelineRows([
      {
        id: "started",
        eventType: "RELATIONSHIP_STARTED",
        title: "Relationship Established",
        description: null,
        occurredAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "preferred",
        eventType: "RELATIONSHIP_TIER_CHANGED",
        title: "Preferred Status Reached",
        description: null,
        occurredAt: "2026-06-01T00:00:00.000Z",
        metadata: { oldTier: "STANDARD", newTier: "PREFERRED", dedupeKey: "tier:STANDARD->PREFERRED" },
      },
      {
        id: "loan",
        eventType: "LOAN_FUNDED",
        title: "Loan Approved",
        description: null,
        occurredAt: "2026-06-01T00:00:00.000Z",
        relatedEntityId: "loan-1",
      },
    ]);

    assert.deepEqual(
      rows.map((row) => row.id),
      ["loan", "preferred", "started"],
    );
  });
});
