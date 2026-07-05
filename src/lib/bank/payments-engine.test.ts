import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS,
  parsePaymentsEnginePlatformSettings,
} from "@/lib/platform/payments-engine-settings-types";

describe("payments engine platform settings", () => {
  it("uses sensible defaults", () => {
    assert.equal(DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS.defaultRetryCount, 3);
    assert.equal(DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS.recurringInvoicesRequirePro, true);
    assert.ok(DEFAULT_PAYMENTS_ENGINE_PLATFORM_SETTINGS.allowedRecurringIntervals.includes("yearly"));
  });

  it("parses partial settings", () => {
    const parsed = parsePaymentsEnginePlatformSettings({ defaultRetryCount: 5 });
    assert.equal(parsed.defaultRetryCount, 5);
    assert.equal(parsed.defaultRetryDelayMinutes, 60);
  });
});

describe("payment engine funding helpers", () => {
  it("builds stable funding source keys", async () => {
    const { paymentEngineFundingSourceKey } = await import("@/server/payment-engine-funding.service");
    assert.equal(
      paymentEngineFundingSourceKey({ kind: "bank_account", accountId: "acct-1" }),
      "bank_account:acct-1",
    );
    assert.equal(
      paymentEngineFundingSourceKey({ kind: "alta_card", cardId: "employee:emp-1" }),
      "alta_card:employee:emp-1",
    );
  });
});

describe("scheduled payment channel mapping", () => {
  it("maps alta pay schedule rows", async () => {
    const { mapAltaPayScheduleRow } = await import("@/server/alta-pay-schedule.service");
    const row = mapAltaPayScheduleRow({
      id: "sched-1",
      companyId: null,
      bankAccountId: "acct-1",
      createdByUserId: "user-1",
      transferScope: "INTRABANK",
      paymentChannel: "ALTA_PAY",
      paymentType: "SCHEDULED",
      label: "District Construction LLC",
      recipientName: "District Construction LLC",
      recipientAccountNumber: null,
      recipientCompanyId: "co-1",
      recipientUserId: null,
      recipientInstitution: null,
      routingNumber: null,
      wireAccountNumber: null,
      amount: { toString: () => "50000" },
      currency: "FLR",
      frequency: null,
      scheduledDate: new Date("2026-07-15T13:00:00.000Z"),
      nextRunDate: null,
      lastRunAt: null,
      consecutiveFailures: 0,
      lastFailureReason: null,
      lastExecutionStatus: null,
      status: "APPROVED",
      memo: null,
      fundingSource: { kind: "bank_account", accountId: "acct-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
      bankAccount: { accountName: "Checking" },
    });
    assert.equal(row.paymentType, "scheduled");
    assert.equal(row.amount, 50000);
    assert.equal(row.status, "approved");
    assert.equal(row.fundingSource.kind, "bank_account");
  });

  it("maps alta card schedule rows", async () => {
    const { mapAltaPayScheduleRow } = await import("@/server/alta-pay-schedule.service");
    const row = mapAltaPayScheduleRow({
      id: "sched-2",
      companyId: null,
      bankAccountId: null,
      createdByUserId: "user-1",
      transferScope: "INTRABANK",
      paymentChannel: "ALTA_PAY",
      paymentType: "RECURRING",
      label: "District Construction LLC",
      recipientName: "District Construction LLC",
      recipientAccountNumber: null,
      recipientCompanyId: "co-1",
      recipientUserId: null,
      recipientInstitution: null,
      routingNumber: null,
      wireAccountNumber: null,
      amount: { toString: () => "1200" },
      currency: "FLR",
      frequency: "MONTHLY",
      scheduledDate: new Date("2026-07-15T13:00:00.000Z"),
      nextRunDate: new Date("2026-08-15T13:00:00.000Z"),
      lastRunAt: null,
      consecutiveFailures: 0,
      lastFailureReason: null,
      lastExecutionStatus: null,
      status: "APPROVED",
      memo: null,
      fundingSource: { kind: "alta_card", cardId: "card-1" },
      createdAt: new Date(),
      updatedAt: new Date(),
      bankAccount: null,
    });
    assert.equal(row.fundingSource.kind, "alta_card");
    assert.equal(row.paymentType, "recurring");
  });
});

describe("alta pay self-company guard", () => {
  it("blocks company bank accounts and alta cards from paying themselves", async () => {
    const { assertAltaPayRecipientNotSameCompany } = await import(
      "@/server/payment-engine-funding.service"
    );

    assert.throws(
      () =>
        assertAltaPayRecipientNotSameCompany(
          "co-1",
          { kind: "bank_account", accountId: "acct-1" },
          { companyId: "co-1" },
        ),
      /Companies cannot send Alta Pay to themselves/,
    );

    assert.throws(
      () =>
        assertAltaPayRecipientNotSameCompany(
          "co-1",
          { kind: "alta_card", cardId: "employee:emp-1" },
          { employerCompanyId: "co-1" },
        ),
      /Companies cannot send Alta Pay to themselves/,
    );

    assert.doesNotThrow(() =>
      assertAltaPayRecipientNotSameCompany(
        "co-2",
        { kind: "bank_account", accountId: "acct-1" },
        { companyId: "co-1" },
      ),
    );
  });
});

describe("recurring invoice scheduling", () => {
  it("schedules runs at 9 AM Eastern and preserves time on recurrence", async () => {
    const {
      parseBankScheduledDateTime,
      calculateNextRunDate,
      wallClockInBankTz,
      DEFAULT_SCHEDULED_TIME_ET,
    } = await import("@/lib/scheduled-datetime");

    const firstRun = parseBankScheduledDateTime("2026-07-05", DEFAULT_SCHEDULED_TIME_ET);
    const firstWall = wallClockInBankTz(firstRun);
    assert.equal(firstWall.hour, 9);
    assert.equal(firstWall.minute, 0);
    assert.equal(firstWall.day, 5);

    const secondRun = calculateNextRunDate("MONTHLY", firstRun);
    const secondWall = wallClockInBankTz(secondRun);
    assert.equal(secondWall.hour, 9);
    assert.equal(secondWall.minute, 0);
    assert.equal(secondWall.month, 8);
    assert.equal(secondWall.day, 5);
  });
});
