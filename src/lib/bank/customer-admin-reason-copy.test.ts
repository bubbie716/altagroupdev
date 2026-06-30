import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatBankRequestDenialMessage } from "./bank-request-status-copy.ts";
import {
  buildLendingApplicationDeniedSystemMessage,
  stripAdminReasonFromCustomerThreadBody,
} from "./secure-deal-room-system-copy.ts";

describe("customer admin reason copy", () => {
  it("never exposes operator review notes in bank denial messages", () => {
    assert.equal(formatBankRequestDenialMessage("Internal underwriting note"), "This request was not approved.");
    assert.equal(formatBankRequestDenialMessage(null), "This request was not approved.");
  });

  it("does not append admin notes to new lending denial system messages", () => {
    const body = buildLendingApplicationDeniedSystemMessage("Outside policy");
    assert.doesNotMatch(body, /Outside policy/);
    assert.doesNotMatch(body, /Alta Credit Desk/);
  });

  it("strips persisted admin note sections from customer thread bodies", () => {
    const legacy = [
      "Your application has been denied.",
      "This Secure Deal Room has been closed.",
      "",
      "Reason from Alta Credit Desk:",
      "",
      "Outside underwriting policy.",
    ].join("\n");

    assert.equal(
      stripAdminReasonFromCustomerThreadBody(legacy),
      "Your application has been denied.\nThis Secure Deal Room has been closed.",
    );
  });
});
