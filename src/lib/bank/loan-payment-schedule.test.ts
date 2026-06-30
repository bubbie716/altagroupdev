import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocatePaymentToScheduleInstallments,
  formatNextPaymentDueLabel,
  rebuildScheduleInstallmentPayments,
  resolveScheduleInstallmentDisplayStatus,
} from "./loan-payment-schedule";

describe("allocatePaymentToScheduleInstallments", () => {
  it("keeps the first installment pending after a partial payment", () => {
    const installments = [
      { id: "a", scheduledAmount: 5750, paidAmount: 0 },
      { id: "b", scheduledAmount: 5375, paidAmount: 0 },
    ];

    const result = allocatePaymentToScheduleInstallments(installments, 750);

    assert.equal(result.primaryInstallmentId, "a");
    assert.equal(result.updates.length, 1);
    assert.equal(result.updates[0]?.paidAmount, 750);
    assert.equal(result.updates[0]?.fullyPaid, false);
  });

  it("does not advance to the next installment until the first is fully paid", () => {
    const installments = [
      { id: "a", scheduledAmount: 5750, paidAmount: 0 },
      { id: "b", scheduledAmount: 5375, paidAmount: 0 },
    ];

    const { installmentStates } = rebuildScheduleInstallmentPayments(installments, [749, 1]);

    assert.equal(installmentStates[0]?.paidAmount, 750);
    assert.equal(installmentStates[0]?.fullyPaid, false);
    assert.equal(installmentStates[1]?.paidAmount, 0);
    assert.equal(installmentStates[1]?.fullyPaid, false);
  });
});

describe("resolveScheduleInstallmentDisplayStatus", () => {
  it("shows partial when an installment has a non-zero balance remaining", () => {
    const status = resolveScheduleInstallmentDisplayStatus(
      "pending",
      new Date("2026-08-30T00:00:00.000Z"),
      5750,
      1,
      new Date("2026-06-30T00:00:00.000Z"),
    );

    assert.equal(status, "partial");
  });
});

describe("formatNextPaymentDueLabel", () => {
  it("shows the remaining installment estimate after a partial payment", () => {
    const label = formatNextPaymentDueLabel(
      {
        dueDate: "2026-07-30T00:00:00.000Z",
        scheduledAmount: 5750,
        paidAmount: 750,
        status: "partial",
      },
      (date) => date.toISOString().slice(0, 10),
    );

    assert.match(label, /5,000\.00/);
  });

  it("shows the full scheduled estimate even when current payoff is lower", () => {
    const label = formatNextPaymentDueLabel(
      {
        dueDate: "2026-08-30T00:00:00.000Z",
        scheduledAmount: 5375,
        paidAmount: 0,
        status: "pending",
      },
      (date) => date.toISOString().slice(0, 10),
    );

    assert.match(label, /5,375\.00/);
  });
});
