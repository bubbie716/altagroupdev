import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isBankAccountPagePath } from "./bank-account-page-path.ts";

describe("isBankAccountPagePath", () => {
  it("matches the account overview and nested tabs", () => {
    assert.equal(isBankAccountPagePath("/bank/account/acc-1", "acc-1"), true);
    assert.equal(isBankAccountPagePath("/bank/account/acc-1/payments", "acc-1"), true);
    assert.equal(isBankAccountPagePath("/bank/account/acc-1/commercial", "acc-1"), true);
  });

  it("rejects other accounts and non-account paths", () => {
    assert.equal(isBankAccountPagePath("/bank/account/acc-2", "acc-1"), false);
    assert.equal(isBankAccountPagePath("/bank/accounts", "acc-1"), false);
    assert.equal(isBankAccountPagePath("/bank", "acc-1"), false);
    assert.equal(isBankAccountPagePath("/bank/account/acc-1", undefined), false);
  });
});
