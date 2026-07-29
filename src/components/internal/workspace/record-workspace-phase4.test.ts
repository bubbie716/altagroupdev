import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("account record workspace", () => {
  it("exposes only Overview, Activity, and More", () => {
    const view = read("components/internal/workspace/account-workspace-view.tsx");
    assert.match(view, /label:\s*"Overview"/);
    assert.match(view, /label:\s*"Activity"/);
    assert.match(view, /label:\s*"More"/);
    assert.doesNotMatch(view, /label:\s*"Transactions"/);
    assert.doesNotMatch(view, /label:\s*"Holds & Restrictions"/);
    assert.match(view, /RecordActionsSheet/);
    assert.match(view, /RecordActivityTimeline/);
  });

  it("moves holds and adjustments out of Overview", () => {
    const view = read("components/internal/workspace/account-workspace-view.tsx");
    const overviewStart = view.indexOf('id: "overview"');
    const activityStart = view.indexOf('id: "activity"');
    const overview = view.slice(overviewStart, activityStart);
    assert.doesNotMatch(overview, /InternalAccountOpsPanel/);
    assert.doesNotMatch(overview, /InternalAccountAdjustmentForm/);
    assert.match(view, /InternalAccountOpsPanel/);
    assert.match(view, /freezeBankAccountRecord/);
  });

  it("route uses parseAccountWorkspaceSearch", () => {
    const route = read("routes/internal/bank/accounts/$accountId.tsx");
    assert.match(route, /parseAccountWorkspaceSearch/);
    assert.match(route, /search=\{search\}/);
  });
});

describe("transaction record", () => {
  it("uses single-page RecordSinglePage without five tabs", () => {
    const view = read("components/internal/workspace/transaction-workspace-view.tsx");
    assert.match(view, /RecordSinglePage/);
    assert.doesNotMatch(view, /label:\s*"Related Records"/);
    assert.doesNotMatch(view, /label:\s*"Review flags"/);
    assert.match(view, /TransactionWorkspaceActions/);
    assert.match(view, /plainTransactionTypeTitle/);
    assert.match(view, /buildTransactionLifecycle/);
  });

  it("keeps approve/deny and reverse handlers", () => {
    const actions = read("components/internal/transaction-workspace-actions.tsx");
    assert.match(actions, /approveBankDeposit/);
    assert.match(actions, /denyBankDeposit/);
    assert.match(actions, /approveBankWithdrawal/);
    assert.match(actions, /denyBankWithdrawal/);
    assert.match(actions, /reverseAdjustmentOps/);
  });

  it("route uses parseTransactionRecordSearch", () => {
    const route = read("routes/internal/bank/transactions/$transactionId.tsx");
    assert.match(route, /parseTransactionRecordSearch/);
    assert.match(route, /search=\{search\}/);
  });
});

describe("money lists preserve from context", () => {
  it("accounts list builds return path", () => {
    const list = read("routes/internal/bank/accounts/index.tsx");
    assert.match(list, /buildListReturnPath/);
    assert.match(list, /from/);
    assert.match(list, /md:hidden/);
  });

  it("transactions list builds return path and plain labels", () => {
    const list = read("routes/internal/bank/transactions/index.tsx");
    assert.match(list, /buildListReturnPath/);
    assert.match(list, /plainTransactionTypeTitle/);
    assert.match(list, /md:hidden/);
  });
});

describe("phase 3 customer/company not regressed", () => {
  it("customer still has three primary tabs", () => {
    const view = read("components/internal/workspace/customer-workspace-view.tsx");
    assert.match(view, /label:\s*"Overview"/);
    assert.match(view, /label:\s*"Activity"/);
    assert.match(view, /label:\s*"More"/);
  });
});
