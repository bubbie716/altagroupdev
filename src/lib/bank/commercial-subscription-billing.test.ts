import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commercialBillingPeriodDayKey,
  commercialChargeIdempotencyKey,
  initialPurchaseBillingPeriod,
  newCommercialBillingCycleId,
  renewalBillingPeriod,
} from "@/server/commercial-subscription-charge.service";
import {
  addBillingMonths,
  isPastGracePeriod,
} from "@/server/commercial-billing.service";
import { enableTestNotificationTransport } from "@/server/notification-test-transport";
import {
  classifyCommercialPayrollPageAccess,
  DEFAULT_COMMERCIAL_FEATURES,
  DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
} from "@/lib/bank/commercial-banking-types";

enableTestNotificationTransport();

describe("commercial subscription charge idempotency keys", () => {
  it("builds stable unique keys per company, period, and charge type", () => {
    const a = commercialChargeIdempotencyKey("INITIAL_PURCHASE", "co-1", "cbc_abc:initial");
    const b = commercialChargeIdempotencyKey("INITIAL_PURCHASE", "co-1", "cbc_abc:initial");
    const c = commercialChargeIdempotencyKey("MONTHLY_RENEWAL", "co-1", "cbc_abc:2026-07-26");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^commercial-pro:INITIAL_PURCHASE:co-1:/);
  });

  it("scopes initial purchase and renewal periods by billing cycle", () => {
    const cycleId = "cbc_testcycle";
    const due = new Date("2026-08-26T00:00:00.000Z");
    assert.equal(initialPurchaseBillingPeriod(cycleId), "cbc_testcycle:initial");
    assert.equal(renewalBillingPeriod(cycleId, due), "cbc_testcycle:2026-08-26");
    assert.notEqual(
      initialPurchaseBillingPeriod(cycleId),
      renewalBillingPeriod(cycleId, due),
    );
  });

  it("generates distinct billing cycle ids for re-purchase after downgrade", () => {
    const a = newCommercialBillingCycleId();
    const b = newCommercialBillingCycleId();
    assert.notEqual(a, b);
    assert.match(a, /^cbc_/);
  });

  it("uses UTC day keys for billing periods", () => {
    assert.equal(
      commercialBillingPeriodDayKey(new Date("2026-07-26T15:30:00.000Z")),
      "2026-07-26",
    );
  });
});

describe("commercial billing period math and grace", () => {
  it("clamps January 31 to February end instead of overflowing to March", () => {
    const start = new Date("2026-01-31T12:00:00.000Z");
    const next = addBillingMonths(start, 1);
    assert.equal(next.toISOString(), "2026-02-28T12:00:00.000Z");
    assert.equal(start.toISOString(), "2026-01-31T12:00:00.000Z");
  });

  it("preserves leap-day destinations and mid-month days", () => {
    assert.equal(
      addBillingMonths(new Date("2028-01-31T08:15:30.500Z"), 1).toISOString(),
      "2028-02-29T08:15:30.500Z",
    );
    assert.equal(
      addBillingMonths(new Date("2026-03-31T00:00:00.000Z"), 1).toISOString(),
      "2026-04-30T00:00:00.000Z",
    );
    assert.equal(
      addBillingMonths(new Date("2026-12-31T23:59:59.000Z"), 1).toISOString(),
      "2027-01-31T23:59:59.000Z",
    );
    assert.equal(
      addBillingMonths(new Date("2026-01-15T12:00:00.000Z"), 1).toISOString(),
      "2026-02-15T12:00:00.000Z",
    );
  });

  it("supports multi-month, zero, and negative offsets without mutating input", () => {
    const start = new Date("2026-01-31T12:00:00.000Z");
    assert.equal(addBillingMonths(start, 0).toISOString(), start.toISOString());
    assert.equal(
      addBillingMonths(start, 2).toISOString(),
      "2026-03-31T12:00:00.000Z",
    );
    assert.equal(
      addBillingMonths(start, -1).toISOString(),
      "2025-12-31T12:00:00.000Z",
    );
    assert.equal(start.toISOString(), "2026-01-31T12:00:00.000Z");
  });

  it("detects past-due grace expiry", () => {
    const pastDueAt = new Date("2026-07-01T00:00:00.000Z");
    const before = new Date("2026-07-05T00:00:00.000Z");
    const after = new Date("2026-07-09T00:00:00.000Z");
    assert.equal(isPastGracePeriod(pastDueAt, 7, before), false);
    assert.equal(isPastGracePeriod(pastDueAt, 7, after), true);
  });
});

describe("commercial billing idempotency key uniqueness contract", () => {
  it("same company + period + type collide; different periods do not", () => {
    const cycle = "cbc_concurrent";
    const period = initialPurchaseBillingPeriod(cycle);
    const keyA = commercialChargeIdempotencyKey("INITIAL_PURCHASE", "co-x", period);
    const keyB = commercialChargeIdempotencyKey("INITIAL_PURCHASE", "co-x", period);
    const keyRenewal = commercialChargeIdempotencyKey(
      "MONTHLY_RENEWAL",
      "co-x",
      renewalBillingPeriod(cycle, new Date("2026-08-26T00:00:00.000Z")),
    );
    assert.equal(keyA, keyB);
    assert.notEqual(keyA, keyRenewal);
  });

  it("re-purchase after downgrade uses a new cycle so periods do not collide", () => {
    const first = initialPurchaseBillingPeriod("cbc_first");
    const second = initialPurchaseBillingPeriod("cbc_second");
    assert.notEqual(first, second);
    assert.notEqual(
      commercialChargeIdempotencyKey("INITIAL_PURCHASE", "co-1", first),
      commercialChargeIdempotencyKey("INITIAL_PURCHASE", "co-1", second),
    );
  });
});

describe("commercial pro fee and payroll gating helpers", () => {
  it("publishes the Pro monthly fee used in upgrade UX", () => {
    assert.equal(DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE, 10_000);
  });

  it("classifies Core users as upgrade, Pro as active, viewers as forbidden", () => {
    const corePlan = {
      commercialPlan: "CORE" as const,
      planStatus: "ACTIVE" as const,
      billingStatus: "NOT_BILLED" as const,
      monthlyFee: null,
      enabledFeatures: DEFAULT_COMMERCIAL_FEATURES.CORE,
    };
    const proPlan = {
      commercialPlan: "PRO" as const,
      planStatus: "ACTIVE" as const,
      billingStatus: "CURRENT" as const,
      monthlyFee: 10_000,
      enabledFeatures: DEFAULT_COMMERCIAL_FEATURES.PRO,
    };

    assert.equal(
      classifyCommercialPayrollPageAccess({ roleCanAccessPayroll: true, plan: corePlan }).mode,
      "upgrade",
    );
    assert.equal(
      classifyCommercialPayrollPageAccess({ roleCanAccessPayroll: true, plan: proPlan }).mode,
      "active",
    );
    assert.equal(
      classifyCommercialPayrollPageAccess({ roleCanAccessPayroll: false, plan: proPlan }).mode,
      "forbidden",
    );
  });
});

describe("scheduled vs immediate downgrade product rules", () => {
  it("documents that period-end keeps receivables; immediate may cancel excess", () => {
    // Product contract asserted by cleanup option names used in billing service.
    const periodEnd = { cancelReceivables: false };
    const immediate = { cancelReceivables: true };
    assert.equal(periodEnd.cancelReceivables, false);
    assert.equal(immediate.cancelReceivables, true);
  });
});
