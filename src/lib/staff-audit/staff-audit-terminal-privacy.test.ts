import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeStaffAuditDetails } from "./staff-audit-privacy.ts";
import { formatStaffAuditMessage } from "./staff-audit-format.ts";

describe("Terminal staff audit privacy", () => {
  it("keeps customer-safe recon summaries and redacts long tokens", () => {
    const sanitized = sanitizeStaffAuditDetails(
      "Supply mismatch detected · evidence=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ",
    );
    assert.ok(sanitized);
    assert.match(sanitized!, /Supply mismatch/);
    assert.match(sanitized!, /\[redacted\]/);
  });

  it("formats Terminal product label for recon critical staff messages", () => {
    const message = formatStaffAuditMessage({
      product: "Alta Terminal",
      action: "Crypto reconciliation critical issue",
      actorLabel: "System",
      details: "Bonding curve reserve drift detected",
      severity: "CRITICAL",
      internalUrl: "/internal/terminal/crypto",
    });
    assert.match(message, /^\[CRITICAL\] \[Alta Terminal\]/);
    assert.doesNotMatch(message, /Alta Bank/);
    assert.doesNotMatch(message, /technicalDetails|treasury evidence/i);
  });
});
