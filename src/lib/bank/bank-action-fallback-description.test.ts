import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bankActionFallbackDescription } from "./bank-action-fallback-description.ts";

describe("bankActionFallbackDescription", () => {
  it("uses phase-aware success copy", () => {
    assert.equal(
      bankActionFallbackDescription("success"),
      "The request completed successfully.",
    );
  });

  it("uses pending wording when requested", () => {
    assert.equal(
      bankActionFallbackDescription("success", { pendingSuccess: true }),
      "The request was submitted for review.",
    );
  });

  it("describes submitting without asking to confirm", () => {
    assert.equal(
      bankActionFallbackDescription("submitting"),
      "Your request is being processed.",
    );
  });

  it("describes error with preserved entries", () => {
    assert.equal(
      bankActionFallbackDescription("error"),
      "The request could not be completed. Your entries were preserved.",
    );
  });

  it("describes details and review steps", () => {
    assert.equal(bankActionFallbackDescription("details"), "Enter the required details.");
    assert.equal(
      bankActionFallbackDescription("review"),
      "Review the details before confirming.",
    );
  });
});
