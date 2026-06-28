import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import fs from "node:fs/promises";
import path from "node:path";

type FlowResult = {
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut" | "interrupted";
  durationMs: number;
  error?: string;
  project: string;
};

export default class QaSummaryReporter implements Reporter {
  private results: FlowResult[] = [];
  private startedAt = new Date().toISOString();

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date().toISOString();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.results.push({
      title: test.titlePath().join(" › "),
      status: result.status,
      durationMs: result.duration,
      error: result.error?.message,
      project: test.parent.project()?.name ?? "unknown",
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const passed = this.results.filter((r) => r.status === "passed");
    const failed = this.results.filter((r) => r.status === "failed" || r.status === "timedOut");
    const skipped = this.results.filter((r) => r.status === "skipped");

    const lines: string[] = [
      "# Alta Bank E2E QA Summary",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Run started: ${this.startedAt}`,
      `Overall status: **${result.status.toUpperCase()}**`,
      "",
      "## Summary",
      "",
      `| Metric | Count |`,
      `|--------|------:|`,
      `| Passed | ${passed.length} |`,
      `| Failed | ${failed.length} |`,
      `| Skipped | ${skipped.length} |`,
      `| Total | ${this.results.length} |`,
      "",
    ];

    if (failed.length > 0) {
      lines.push("## Failed flows", "");
      for (const item of failed) {
        lines.push(`- **${item.title}** (${item.project})`);
        if (item.error) lines.push(`  - \`${item.error.split("\n")[0]}\``);
      }
      lines.push("");
    }

    if (passed.length > 0) {
      lines.push("## Passed flows", "");
      for (const item of passed.slice(0, 80)) {
        lines.push(`- ${item.title}`);
      }
      if (passed.length > 80) {
        lines.push(`- … and ${passed.length - 80} more`);
      }
      lines.push("");
    }

    if (skipped.length > 0) {
      lines.push("## Skipped flows", "");
      for (const item of skipped.slice(0, 30)) {
        lines.push(`- ${item.title}`);
      }
      lines.push("");
    }

    lines.push(
      "## Reports",
      "",
      "- HTML report: `npm run test:e2e:report`",
      "- Failure screenshots: `test-results/`",
      "- Visual screenshots: `tests/e2e/reports/screenshots/`",
      "",
      "## Recommendations",
      "",
      failed.length === 0
        ? "- All executed flows passed. Review skipped mutation tests if `E2E_TEST_MODE` was not set."
        : "- Fix failed routes/flows above, then re-run `npm run test:e2e:headed` to watch regressions.",
      "",
    );

    const outDir = path.resolve("tests/e2e/reports");
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, "qa-summary.md"), lines.join("\n"));
  }
}
