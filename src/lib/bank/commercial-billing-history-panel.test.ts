import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("commercial subscription billing history panel", () => {
  it("passes BankMobileStackField children instead of unsupported value props", () => {
    const panel = read(
      "components/bank/commercial/commercial-subscription-billing-history-panel.tsx",
    );
    assert.match(panel, /BankMobileStackField label="Period">\{charge\.billingPeriodLabel\}/);
    assert.match(panel, /BankMobileStackField label="Status">\{charge\.statusLabel\}/);
    assert.match(panel, /BankMobileStackField label="Billing account">/);
    assert.match(panel, /BankMobileStackField label="Failure reason">\{charge\.failureReason\}/);
    assert.doesNotMatch(panel, /BankMobileStackField[^>]*\svalue=/);
  });
});

describe("merchant invoice UI Lab server-function branches", () => {
  it("routes create/update/send/cancel/remind through UI Lab fixtures", () => {
    const fns = read("lib/bank/merchant-invoice.functions.ts");
    assert.match(fns, /createUiLabInvoiceDraft/);
    assert.match(fns, /updateUiLabInvoiceDraft/);
    assert.match(fns, /sendUiLabInvoice/);
    assert.match(fns, /cancelUiLabInvoice/);
    assert.match(fns, /remindUiLabInvoice/);
  });
});

describe("statement UI Lab server-function branches", () => {
  it("routes account/detail/generate/center through UI Lab fixtures", () => {
    const fns = read("lib/bank/statement.functions.ts");
    assert.match(fns, /getUiLabAccountStatements/);
    assert.match(fns, /getUiLabStatementDetail/);
    assert.match(fns, /generateUiLabAccountStatement/);
    assert.match(fns, /getUiLabStatementCenterStatements/);
    assert.match(fns, /getUiLabStatementGeneratableAccounts/);
    assert.match(fns, /generateUiLabAccountStatementsBatch/);
  });
});
