import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("portfolio chart mobile tap vs drag wiring", () => {
  it("hover listens for tap pointerup and keeps sticky tooltips", () => {
    const hover = read("components/account/portfolio-chart-hover.tsx");
    assert.match(hover, /addEventListener\("pointerup"/);
    assert.match(hover, /stickyRef/);
    assert.match(hover, /isPointerDragPastThreshold/);
    assert.match(hover, /pointerType !== "mouse"/);
    assert.match(hover, /addEventListener\("mousemove"/);
  });

  it("range selection defers drag until movement past the shared threshold", () => {
    const range = read("components/account/portfolio-chart-range-selection.tsx");
    assert.match(range, /pendingPressRef/);
    assert.match(range, /isPointerDragPastThreshold/);
    assert.match(range, /beginDrag/);
    // Must not claim every press as a drag on pointerdown.
    assert.doesNotMatch(
      range,
      /handlePointerDown = \(event: PointerEvent\) => \{\s*if \(event\.button !== 0\) return;\s*event\.preventDefault\(\);\s*const index = resolveIndexFromClientX/,
    );
  });

  it("corporate and terminal charts share the same interaction hooks", () => {
    const dashboard = read("components/account/portfolio-dashboard.tsx");
    const terminal = read("components/terminal/portfolio-chart.tsx");
    assert.match(dashboard, /usePortfolioChartHover/);
    assert.match(dashboard, /usePortfolioChartRangeSelection/);
    assert.match(terminal, /usePortfolioChartHover/);
    assert.match(terminal, /usePortfolioChartRangeSelection/);
  });
});
