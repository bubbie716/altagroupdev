import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 6 money ops mobile structure", () => {
  it("transfer list provides mobile cards and desktop table", () => {
    const source = read("routes/internal/bank/transfers/index.tsx");
    assert.match(source, /md:hidden/);
    assert.match(source, /hidden.*md:block/);
    assert.match(source, /Needs attention/);
    assert.match(source, /from: returnFrom|returnFrom/);
    assert.match(source, /transferReviewCta|Review transfer|Review failed transfer/);
    assert.doesNotMatch(source, />\s*Open\s*</);
    assert.doesNotMatch(source, /View failed/);
  });

  it("compact money records use RecordSinglePage", () => {
    for (const file of [
      "components/internal/workspace/scheduled-transfer-workspace-view.tsx",
      "components/internal/workspace/alta-pay-payment-workspace-view.tsx",
      "components/internal/workspace/invoice-workspace-view.tsx",
      "components/internal/workspace/payment-link-workspace-view.tsx",
    ]) {
      const source = read(file);
      assert.match(source, /RecordSinglePage/);
      assert.match(source, /parseReturnPath/);
    }
  });

  it("resolved transfers hide pending-only controls", () => {
    const source = read("components/internal/workspace/scheduled-transfer-workspace-view.tsx");
    assert.match(source, /RESOLVED_STATUSES/);
    assert.match(source, /isResolved \? \[\] : availableTransferActions/);
  });

  it("payment link record keeps checkout details secondary", () => {
    const source = read("components/internal/workspace/payment-link-workspace-view.tsx");
    assert.match(source, /RecordMoreSection|technical|checkout/i);
    assert.doesNotMatch(source, /secret token|raw token/i);
  });
});
