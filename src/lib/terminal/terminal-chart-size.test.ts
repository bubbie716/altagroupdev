import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  chartPixelSize,
  isMeasurableChartSize,
} from "./terminal-chart-size";

describe("terminal chart size helpers", () => {
  it("rejects zero, negative, and non-finite sizes", () => {
    assert.equal(isMeasurableChartSize({ width: 0, height: 120 }), false);
    assert.equal(isMeasurableChartSize({ width: 320, height: 0 }), false);
    assert.equal(isMeasurableChartSize({ width: -1, height: -1 }), false);
    assert.equal(isMeasurableChartSize({ width: Number.NaN, height: 100 }), false);
    assert.equal(isMeasurableChartSize({ width: 390, height: 220 }), true);
  });

  it("floors to whole positive pixels", () => {
    assert.deepEqual(chartPixelSize({ width: 389.7, height: 219.2 }), {
      width: 389,
      height: 219,
    });
    assert.deepEqual(chartPixelSize({ width: 0.4, height: 0.9 }), {
      width: 1,
      height: 1,
    });
  });
});

describe("Terminal portfolio-chart Recharts sizing contract", () => {
  const chartSrc = readFileSync(
    join(process.cwd(), "src/components/terminal/portfolio-chart.tsx"),
    "utf8",
  );

  it("does not import percentage responsive chart wrappers", () => {
    assert.doesNotMatch(chartSrc, /from ["']recharts["'][\s\S]*ResponsiveContainer|ResponsiveContainer[\s\S]*from ["']recharts["']/);
    assert.doesNotMatch(chartSrc, /import\s*\{[^}]*ResponsiveContainer/);
    assert.match(chartSrc, /chartPixelSize/);
    assert.match(chartSrc, /isMeasurableChartSize/);
    assert.match(chartSrc, /width=\{pixelSize\.width\}/);
    assert.match(chartSrc, /height=\{pixelSize\.height\}/);
  });

  it("keeps fixed height classes so reserved space does not collapse before measure", () => {
    assert.match(chartSrc, /h-\[220px\] sm:h-\[260px\]/);
    assert.match(chartSrc, /100svh-29rem/);
    assert.match(chartSrc, /min-\[360px\]:h-\[188px\]/);
  });
});
