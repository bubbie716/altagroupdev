import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 7 Terminal workspace structure", () => {
  it("keeps portfolio workspace three-tab and order record tabless", () => {
    const portfolio = read("components/internal/workspace/terminal-portfolio-workspace-view.tsx");
    const order = read("components/internal/workspace/terminal-order-workspace-view.tsx");
    assert.match(portfolio, /id: "overview"/);
    assert.match(portfolio, /id: "activity"/);
    assert.match(portfolio, /id: "more"/);
    assert.match(order, /RecordSinglePage/);
    assert.doesNotMatch(order, /tabs=\{/);
  });

  it("uses mobile cards and desktop tables on Terminal lists", () => {
    for (const rel of [
      "routes/internal/terminal/investors/index.tsx",
      "routes/internal/terminal/portfolios/index.tsx",
      "routes/internal/terminal/orders/index.tsx",
    ]) {
      const src = read(rel);
      assert.match(src, /md:hidden|space-y-3 md:hidden/);
      assert.match(src, /hidden(?:\s[\w/-]+)*\smd:block|md:block/);
      assert.match(src, /<table/);
    }
  });

  it("shows System readiness checklist without fake success controls", () => {
    const system = read("routes/internal/terminal/system.tsx");
    assert.match(system, /Connection/);
    assert.match(system, /Readiness/);
    assert.match(system, /not_implemented|Not implemented|not implemented|readiness/i);
    assert.doesNotMatch(system, /Fully reconciled/);
    assert.doesNotMatch(system, /Run reconciliation|Schedule recurring/);
  });
});
