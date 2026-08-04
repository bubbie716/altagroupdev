import test from "node:test";
import assert from "node:assert/strict";
import {
  isActiveLoan,
  isPreviousLoan,
  normalizeLoanStatus,
} from "@/lib/bank/lending-loans-display";

test("normalizes loan status casing and separators for customer presentation", () => {
  assert.equal(normalizeLoanStatus("ACTIVE"), "active");
  assert.equal(normalizeLoanStatus("FROZEN"), "frozen");
  assert.equal(normalizeLoanStatus("PAID_OFF"), "paid_off");
  assert.equal(normalizeLoanStatus("paid-off"), "paid_off");
  assert.equal(normalizeLoanStatus("CANCELED"), "cancelled");
});

test("unknown loan statuses stay out of payable/active presentation", () => {
  assert.equal(isActiveLoan("ACTIVE"), true);
  assert.equal(isPreviousLoan("PAID_OFF"), true);
  assert.equal(isActiveLoan("new_future_state"), false);
  assert.equal(isPreviousLoan("new_future_state"), true);
});
