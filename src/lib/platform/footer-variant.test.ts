import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFooterVariant } from "@/lib/platform/footer-variant";

describe("footer variant", () => {
  it("uses dashboard footers for authenticated Bank and Terminal surfaces", () => {
    assert.equal(resolveFooterVariant("/bank"), "dashboard");
    assert.equal(resolveFooterVariant("/bank/activity"), "dashboard");
    assert.equal(resolveFooterVariant("/terminal"), "dashboard");
    assert.equal(resolveFooterVariant("/terminal/markets"), "dashboard");
  });

  it("preserves compact footers for printable Bank statements", () => {
    assert.equal(resolveFooterVariant("/bank/accounts/123/statements/statement-1"), "auth");
  });
});
