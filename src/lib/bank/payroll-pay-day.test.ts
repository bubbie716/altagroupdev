import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNextPayDate,
  getDefaultPayDay,
  getPayDayOptions,
  isValidPayDay,
} from "@/lib/bank/payroll-pay-day";

describe("payroll pay day validation", () => {
  it("defaults pay days per frequency", () => {
    assert.equal(getDefaultPayDay("weekly"), "friday");
    assert.equal(getDefaultPayDay("biweekly"), "friday");
    assert.equal(getDefaultPayDay("monthly"), "first_of_month");
    assert.equal(getDefaultPayDay("quarterly"), "first_of_quarter");
  });

  it("validates pay day against frequency", () => {
    assert.equal(isValidPayDay("weekly", "monday"), true);
    assert.equal(isValidPayDay("weekly", "first_of_month"), false);
    assert.equal(isValidPayDay("monthly", "15th"), true);
    assert.equal(isValidPayDay("monthly", "friday"), false);
    assert.equal(isValidPayDay("quarterly", "last_of_quarter"), true);
    assert.equal(isValidPayDay("quarterly", "15th"), false);
  });

  it("exposes frequency-specific options", () => {
    assert.ok(getPayDayOptions("weekly").some((option) => option.value === "friday"));
    assert.ok(getPayDayOptions("monthly").some((option) => option.value === "last_of_month"));
    assert.ok(getPayDayOptions("quarterly").some((option) => option.value === "first_of_quarter"));
  });

  it("computes the next monthly pay date after a known point", () => {
    const from = new Date("2026-03-10T14:00:00.000Z");
    const next = computeNextPayDate("monthly", "15th", from, true);
    assert.ok(next.getTime() > from.getTime());
    const later = computeNextPayDate("monthly", "15th", next, true);
    assert.ok(later.getTime() > next.getTime());
  });
});
