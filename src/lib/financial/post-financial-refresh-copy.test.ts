import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { financialRefreshCopy } from "@/lib/financial/post-financial-refresh";
import { mutationRefreshCopy } from "@/lib/router/post-mutation-refresh";

describe("financial refresh copy a11y (alias)", () => {
  it("aliases shared mutation refresh copy", () => {
    assert.deepEqual(financialRefreshCopy("refreshing"), mutationRefreshCopy("refreshing"));
    assert.deepEqual(financialRefreshCopy("updated"), mutationRefreshCopy("updated"));
    assert.deepEqual(financialRefreshCopy("failed"), mutationRefreshCopy("failed"));
  });

  it("failed refresh copy keeps transaction successful", () => {
    const copy = financialRefreshCopy("failed");
    assert.match(copy.live, /completed/i);
    assert.match(copy.visible ?? "", /may take a moment/i);
    assert.doesNotMatch(copy.live, /failed|error/i);
  });

  it("does not announce every animation frame — only status phrases", () => {
    assert.equal(financialRefreshCopy("refreshing").live, "Updating.");
    assert.equal(financialRefreshCopy("updated").live, "Updated.");
  });
});
