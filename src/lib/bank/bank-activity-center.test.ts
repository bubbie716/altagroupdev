import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  activityAutopayHref,
  activityRequestsHref,
  activityScheduledHref,
  activityTransactionHref,
  mergeBankActivityCenterSearch,
  parseBankActivityCenterSearch,
  stripBankActivityDetailSearch,
} from "./bank-activity-center-url.ts";
import {
  filterActivityCenterByAccount,
  filterAutopayByAccount,
  findAuthorizedRequest,
  findAuthorizedTransaction,
  isPendingMoneyRequestTransaction,
  isVisibleActivityRequest,
  mapAltaPaySchedule,
  mapTransferSchedule,
} from "./bank-activity-center-types.ts";
import {
  buildOperatorTransactionLink,
} from "./customer-operator-notification-copy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("bank activity center URL", () => {
  it("defaults view to activity and parses detail ids", () => {
    assert.deepEqual(parseBankActivityCenterSearch({}), { view: "activity" });
    assert.deepEqual(parseBankActivityCenterSearch("?view=requests&requestId=req_1"), {
      view: "requests",
      requestId: "req_1",
    });
    assert.equal(parseBankActivityCenterSearch({ view: "nope" }).view, "activity");
  });

  it("accepts legacy ?transaction= as transactionId for Activity view", () => {
    assert.deepEqual(parseBankActivityCenterSearch("?transaction=tx_legacy"), {
      view: "activity",
      transactionId: "tx_legacy",
    });
    assert.equal(
      parseBankActivityCenterSearch({
        view: "activity",
        transactionId: "tx_new",
        transaction: "tx_old",
      }).transactionId,
      "tx_new",
    );
  });

  it("strips only detail keys when closing a sheet", () => {
    const next = stripBankActivityDetailSearch({
      view: "requests",
      requestId: "req_1",
      site: "bank",
    });
    assert.deepEqual(next, { view: "requests", site: "bank" });
  });

  it("merges view switches without leaking prior detail ids when cleared", () => {
    const next = mergeBankActivityCenterSearch(
      { view: "activity", transactionId: "tx_1", site: "bank" },
      { view: "scheduled", transactionId: undefined, scheduleId: "sch_1" },
    );
    assert.equal(next.view, "scheduled");
    assert.equal(next.scheduleId, "sch_1");
    assert.equal(next.transactionId, undefined);
    assert.equal(next.site, "bank");
  });

  it("builds stable deep-link helpers", () => {
    assert.equal(activityRequestsHref("req_1"), "/bank/activity?view=requests&requestId=req_1");
    assert.equal(
      activityTransactionHref("tx_1"),
      "/bank/activity?view=activity&transactionId=tx_1",
    );
    assert.equal(
      activityScheduledHref({ scheduleId: "sch_1", accountId: "acc_1" }),
      "/bank/activity?view=scheduled&scheduleId=sch_1&accountId=acc_1",
    );
    assert.equal(activityAutopayHref("ap_1"), "/bank/activity?view=autopay&approvalId=ap_1");
  });

  it("uses canonical transactionId links for operator notifications", () => {
    assert.equal(
      buildOperatorTransactionLink("tx_op_1"),
      "/bank/activity?view=activity&transactionId=tx_op_1",
    );
    assert.doesNotMatch(buildOperatorTransactionLink("tx_op_1"), /[?&]transaction=/);
  });
});

describe("bank activity center authorization helpers", () => {
  it("only resolves records present in the authorized bundle", () => {
    assert.equal(findAuthorizedRequest([{ id: "a" } as never], "b"), null);
    assert.equal(findAuthorizedRequest([{ id: "a" } as never], "a")?.id, "a");
    assert.equal(findAuthorizedTransaction([{ id: "t1" } as never], "missing"), null);
  });

  it("keeps pending deposit/withdrawal out of Activity history", () => {
    assert.equal(isPendingMoneyRequestTransaction({ type: "deposit", status: "pending" }), true);
    assert.equal(isPendingMoneyRequestTransaction({ type: "withdrawal", status: "pending" }), true);
    assert.equal(isPendingMoneyRequestTransaction({ type: "deposit", status: "approved" }), false);
    assert.equal(isPendingMoneyRequestTransaction({ type: "transfer", status: "pending" }), false);
  });

  it("keeps approved requests out of Requests while pending and denied remain", () => {
    assert.equal(isVisibleActivityRequest({ status: "pending" }), true);
    assert.equal(isVisibleActivityRequest({ status: "denied" }), true);
    assert.equal(isVisibleActivityRequest({ status: "approved" }), false);
  });

  it("scopes rows and AutoPay to the selected account only", () => {
    const rows = [
      { id: "1", bankAccountId: "acc_a" },
      { id: "2", bankAccountId: "acc_b" },
    ];
    assert.deepEqual(
      filterActivityCenterByAccount(rows, "acc_a").map((row) => row.id),
      ["1"],
    );
    assert.deepEqual(filterActivityCenterByAccount(rows, undefined), rows);
    assert.deepEqual(
      filterAutopayByAccount(
        [
          { id: "ap1", fundingSource: { kind: "bank_account", accountId: "acc_a" } } as never,
          { id: "ap2", fundingSource: { kind: "bank_account", accountId: "acc_b" } } as never,
          { id: "ap3", fundingSource: { kind: "alta_card", cardId: "card_1" } } as never,
        ],
        "acc_a",
      ).map((row) => row.id),
      ["ap1"],
    );
  });

  it("maps transfer and alta pay schedules without inventing pause for transfers", () => {
    const transfer = mapTransferSchedule({
      id: "s1",
      transferScope: "intrabank",
      transferScopeLabel: "Intrabank",
      paymentType: "recurring",
      paymentTypeLabel: "Recurring",
      label: "Rent",
      recipientName: "Savings",
      recipientAccountNumber: null,
      recipientInstitution: null,
      routingNumber: null,
      wireAccountNumber: null,
      amount: 10,
      currency: "FLN",
      frequency: "monthly",
      frequencyLabel: "Monthly",
      scheduledDate: null,
      nextRunDate: "2026-08-01T00:00:00.000Z",
      lastRunAt: null,
      lastExecutionStatus: null,
      lastExecutionStatusLabel: null,
      lastFailureReason: null,
      consecutiveFailures: 0,
      status: "approved",
      statusLabel: "Approved",
      memo: null,
      bankAccountId: "acc_1",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(transfer.canPause, false);
    assert.equal(transfer.canCancel, true);
    assert.equal(transfer.kind, "transfer");

    const pay = mapAltaPaySchedule({
      id: "p1",
      paymentType: "scheduled",
      paymentTypeLabel: "Scheduled",
      payeeLabel: "Cafe",
      recipientCompanyId: null,
      recipientUserId: "u2",
      amount: 5,
      frequency: null,
      frequencyLabel: null,
      scheduledDate: "2026-08-02T00:00:00.000Z",
      nextRunDate: null,
      lastRunAt: null,
      status: "approved",
      statusLabel: "Approved",
      memo: null,
      bankAccountId: "acc_1",
      fundingSource: { kind: "bank_account", accountId: "acc_1" },
      fundingAccountLabel: "Checking",
      consecutiveFailures: 0,
      lastFailureReason: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    assert.equal(pay.canPause, true);
    assert.equal(pay.kind, "alta_pay");
  });
});

describe("compatibility redirects for money actions", () => {
  it("keeps Activity detail navigations from resetting page scroll", () => {
    const source = read("components/bank/activity-center/bank-activity-center.tsx");
    assert.match(source, /resetScroll:\s*false/);
  });

  it("converts deposit/withdraw/open/pay/intrabank pages to redirects", () => {
    for (const rel of [
      "routes/bank/deposit.tsx",
      "routes/bank/withdraw.tsx",
      "routes/bank/open.tsx",
      "routes/bank/pay/index.tsx",
      "routes/bank/transfers/intrabank.tsx",
    ]) {
      const source = read(rel);
      assert.match(source, /throw redirect/);
      assert.doesNotMatch(source, /BankActionPageSurface/);
    }
  });

  it("keeps invoice routes as dedicated pages", () => {
    assert.match(read("routes/bank/pay/invoices/index.tsx"), /CustomerInvoicesInbox|fetchReceivedInvoices/);
    assert.match(read("routes/bank/pay/invoices/$invoiceId.tsx"), /invoiceId/);
  });

  it("routes scheduled account aliases to account-scoped Activity scheduled view", () => {
    const account = read("routes/bank/account/$accountId/activity.tsx");
    const scheduled = read("routes/bank/account/$accountId/scheduled.tsx");
    const legacyParent = read("routes/bank/accounts/$accountId/route.tsx");
    const legacyActivity = read("routes/bank/accounts/$accountId/activity.tsx");
    const legacyScheduled = read("routes/bank/accounts/$accountId/scheduled.tsx");
    assert.match(account, /BankActivityCenter/);
    assert.match(scheduled, /\/bank\/account\/\$accountId\/activity/);
    assert.match(scheduled, /view:\s*"scheduled"/);
    assert.match(scheduled, /replace:\s*true/);
    assert.doesNotMatch(legacyParent, /throw redirect/);
    assert.match(legacyActivity, /\/bank\/account\/\$accountId\/activity/);
    assert.match(legacyActivity, /transactionId/);
    assert.match(legacyActivity, /replace:\s*true/);
    assert.match(legacyScheduled, /\/bank\/account\/\$accountId\/activity/);
    assert.match(legacyScheduled, /view:\s*"scheduled"/);
  });

  it("preserves money-action search params on compatibility redirects", () => {
    assert.match(read("routes/bank/deposit.tsx"), /accountId/);
    assert.match(read("routes/bank/withdraw.tsx"), /accountId/);
    assert.match(read("routes/bank/open.tsx"), /accountType/);
    assert.match(read("routes/bank/open.tsx"), /companyId/);
    assert.match(read("routes/bank/pay/index.tsx"), /cardId/);
    assert.match(read("routes/bank/pay/index.tsx"), /employeeCardId/);
    assert.match(read("routes/bank/pay/index.tsx"), /view:\s*"scheduled"/);
    assert.match(read("routes/bank/pay/index.tsx"), /view:\s*"autopay"/);
    assert.match(read("routes/bank/transfers/intrabank.tsx"), /accountId/);
  });
});
