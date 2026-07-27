import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountCommercialPath,
  accountCommercialPaymentsPath,
  accountCommercialRoutes,
  legacyAccountPaymentsRedirectTarget,
} from "@/lib/bank/account-commercial-path";

describe("account-commercial-path", () => {
  it("builds the payments commercial segment", () => {
    assert.equal(
      accountCommercialPath("acc-1", "payments"),
      "/bank/account/acc-1/commercial/payments",
    );
    assert.equal(
      accountCommercialPaymentsPath("acc-1"),
      "/bank/account/acc-1/commercial/payments",
    );
    assert.equal(accountCommercialRoutes.payments, "/bank/account/$accountId/commercial/payments");
  });

  it("does not treat payments as the commercial overview", () => {
    const overview = accountCommercialPath("acc-1");
    const payments = legacyAccountPaymentsRedirectTarget("acc-1");
    assert.equal(overview, "/bank/account/acc-1/commercial");
    assert.equal(payments, "/bank/account/acc-1/commercial/payments");
    assert.notEqual(payments, overview);
    assert.ok(payments.endsWith("/payments"));
    assert.ok(!payments.endsWith("/commercial"));
  });
});
