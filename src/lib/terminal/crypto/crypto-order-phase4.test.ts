/**
 * Phase 4 lifecycle / ops permission and transition source contracts.
 * Does not require migrated DB for most assertions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isLifecycleTransitionAllowed,
  resolveLifecycleTransition,
  transitionRequiresCorporateAdmin,
} from "@/lib/terminal/crypto/crypto-lifecycle.service";
import { finalizeReadiness } from "@/lib/terminal/crypto/crypto-activation-readiness.service";
import {
  mergeCryptoIntoPortfolioHistory,
  quantityHeldAt,
} from "@/lib/terminal/crypto/crypto-portfolio-history";

describe("Phase 4 crypto lifecycle transitions", () => {
  it("allows the documented transition matrix only", () => {
    const allowed: Array<[string, string]> = [
      ["DRAFT", "ACTIVE"],
      ["DRAFT", "CLOSED"],
      ["ACTIVE", "HALTED"],
      ["ACTIVE", "REDEMPTION_ONLY"],
      ["HALTED", "REDEMPTION_ONLY"],
      ["HALTED", "ACTIVE"],
      ["REDEMPTION_ONLY", "ACTIVE"],
      ["REDEMPTION_ONLY", "HALTED"],
      ["REDEMPTION_ONLY", "CLOSED"],
    ];
    for (const [from, to] of allowed) {
      assert.equal(
        isLifecycleTransitionAllowed(from as never, to as never),
        true,
        `${from}→${to}`,
      );
    }
    assert.equal(isLifecycleTransitionAllowed("CLOSED", "ACTIVE"), false);
    assert.equal(isLifecycleTransitionAllowed("DRAFT", "HALTED"), false);
    assert.equal(isLifecycleTransitionAllowed("ACTIVE", "DRAFT"), false);
    assert.equal(isLifecycleTransitionAllowed("ACTIVE", "CLOSED"), false);
  });

  it("requires Corporate admin for activate/resume/close", () => {
    assert.equal(transitionRequiresCorporateAdmin("DRAFT_TO_ACTIVE"), true);
    assert.equal(transitionRequiresCorporateAdmin("HALTED_TO_ACTIVE"), true);
    assert.equal(transitionRequiresCorporateAdmin("REDEMPTION_ONLY_TO_CLOSED"), true);
    assert.equal(transitionRequiresCorporateAdmin("ACTIVE_TO_HALTED"), false);
    assert.equal(transitionRequiresCorporateAdmin("ACTIVE_TO_REDEMPTION_ONLY"), false);
  });

  it("resolves transition keys", () => {
    assert.equal(resolveLifecycleTransition("ACTIVE", "HALTED"), "ACTIVE_TO_HALTED");
    assert.equal(resolveLifecycleTransition("CLOSED", "ACTIVE"), null);
  });
});

describe("Phase 4 activation readiness helper", () => {
  it("fails readiness when any CRITICAL/WARNING item fails", () => {
    const result = finalizeReadiness({
      symbol: "NVA",
      items: [
        { key: "a", label: "A", passed: true, detail: "", severity: "INFO" },
        { key: "b", label: "B", passed: false, detail: "no", severity: "CRITICAL" },
      ],
    });
    assert.equal(result.allPassed, false);
  });

  it("passes when all CRITICAL/WARNING items pass", () => {
    const result = finalizeReadiness({
      symbol: "NPFC",
      items: [
        { key: "a", label: "A", passed: true, detail: "", severity: "CRITICAL" },
        { key: "b", label: "B", passed: true, detail: "", severity: "WARNING" },
        { key: "c", label: "C", passed: false, detail: "info only", severity: "INFO" },
      ],
    });
    assert.equal(result.allPassed, true);
  });
});

describe("Phase 4 portfolio history honesty", () => {
  it("contributes nothing before first fill and NPFC pegs at ƒ1", () => {
    const fills = [
      {
        symbol: "NPFC",
        side: "BUY" as const,
        quantity: 10,
        executedAtMs: 2_000,
        executionPrice: 1,
      },
    ];
    const merged = mergeCryptoIntoPortfolioHistory({
      baseSeries: [
        { t: 1_000, v: 100 },
        { t: 2_000, v: 110 },
        { t: 3_000, v: 120 },
      ],
      fills,
      assets: [{ symbol: "NPFC", pegPrice: 1, candles: [] }],
    });
    assert.equal(quantityHeldAt(fills, "NPFC", 1_500), 0);
    assert.equal(quantityHeldAt(fills, "NPFC", 2_000), 10);
    assert.ok(merged.series[0]!.v === 100);
    assert.ok(merged.series[1]!.v >= 110 + 10 - 0.0001);
  });
});

describe("Phase 4 ops source contracts", () => {
  it("gates mutations with UI Lab assert and role-separated actions", () => {
    const fns = readFileSync(
      join(process.cwd(), "src/lib/terminal/crypto/crypto-ops.functions.ts"),
      "utf8",
    );
    assert.match(fns, /assertNotUiLabMutation/);
    assert.match(fns, /requireAdmin/);
    assert.match(fns, /requireTerminalAdmin/);
    assert.match(fns, /transitionCryptoAssetStatusFn/);
    assert.match(fns, /sweepCryptoRevenueFn/);
    assert.match(fns, /runCryptoReconciliationFn/);
  });

  it("documents quote secret and revenue portfolio env", () => {
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    assert.match(env, /TERMINAL_CRYPTO_QUOTE_SECRET/);
    assert.match(env, /TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID/);
    assert.equal((env.match(/TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID=/g) ?? []).length, 1);
  });

  it("registers reconciliation and candle jobs", () => {
    const catalog = readFileSync(
      join(process.cwd(), "src/lib/internal/ops-jobs-catalog.ts"),
      "utf8",
    );
    assert.match(catalog, /terminal_crypto_reconciliation/);
    assert.match(catalog, /terminal_crypto_candle_rollup/);
  });

  it("includes a Phase 4 operations runbook", () => {
    const doc = readFileSync(
      join(process.cwd(), "docs/terminal-crypto-operations.md"),
      "utf8",
    );
    assert.match(doc, /fictional Minecraft/i);
    assert.match(doc, /Activation/);
    assert.match(doc, /Reconciliation/);
    assert.match(doc, /Revenue sweep/);
    assert.match(doc, /arbitrary balance/i);
  });

  it("never auto-repairs in reconciliation service", () => {
    const recon = readFileSync(
      join(process.cwd(), "src/lib/terminal/crypto/crypto-reconciliation.service.ts"),
      "utf8",
    );
    assert.match(recon, /Do not auto-repair|read-only|Read-only/i);
    assert.doesNotMatch(recon, /protectedReserve:\s*d\(/);
  });
});
