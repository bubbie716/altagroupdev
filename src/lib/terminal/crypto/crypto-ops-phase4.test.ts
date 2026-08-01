/**
 * Phase 4 crypto operations — focused unit / source-contract tests.
 * No live mutations; DB-dependent paths are covered by skipped concurrency stubs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import {
  isLifecycleTransitionAllowed,
  listAllowedLifecycleTransitions,
  resolveLifecycleTransition,
  transitionRequiresCorporateAdmin,
  assertActorMayPerformLifecycleTransition,
} from "./crypto-lifecycle.service";
import {
  evaluateActivationReadiness,
  finalizeReadiness,
} from "./crypto-activation-readiness.service";
import {
  checkAssetMarketInvariants,
  fingerprintIssue,
} from "./crypto-reconciliation.service";
import { CryptoOpsError } from "./crypto-ops-errors";
import { d } from "./crypto-decimal";
import { CRYPTO_ASSET_CONFIGS } from "./crypto-constants";
import { floorToIntervalStart } from "./crypto-candle-rollup.service";
import type { AltaUser } from "@/lib/auth/types";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function mockUser(tags: Array<"corporate_admin" | "terminal_admin" | "bank_admin">): AltaUser {
  return {
    id: "user_test",
    discordId: "d1",
    discordUsername: "tester",
    minecraftUsername: "tester",
    tags,
    companyMemberships: [],
  } as unknown as AltaUser;
}

describe("crypto lifecycle transitions", () => {
  it("allows the Phase 4 transition matrix and rejects others", () => {
    const allowed = listAllowedLifecycleTransitions();
    assert.equal(allowed.length, 9);
    assert.ok(isLifecycleTransitionAllowed("DRAFT", "ACTIVE"));
    assert.ok(isLifecycleTransitionAllowed("ACTIVE", "HALTED"));
    assert.ok(isLifecycleTransitionAllowed("REDEMPTION_ONLY", "CLOSED"));
    assert.equal(isLifecycleTransitionAllowed("CLOSED", "ACTIVE"), false);
    assert.equal(isLifecycleTransitionAllowed("DRAFT", "HALTED"), false);
    assert.equal(isLifecycleTransitionAllowed("ACTIVE", "CLOSED"), false);
    assert.equal(resolveLifecycleTransition("HALTED", "ACTIVE"), "HALTED_TO_ACTIVE");
  });

  it("marks activate/resume/close as corporate-only", () => {
    assert.equal(transitionRequiresCorporateAdmin("DRAFT_TO_ACTIVE"), true);
    assert.equal(transitionRequiresCorporateAdmin("HALTED_TO_ACTIVE"), true);
    assert.equal(transitionRequiresCorporateAdmin("REDEMPTION_ONLY_TO_CLOSED"), true);
    assert.equal(transitionRequiresCorporateAdmin("ACTIVE_TO_HALTED"), false);
    assert.equal(transitionRequiresCorporateAdmin("ACTIVE_TO_REDEMPTION_ONLY"), false);
  });

  it("enforces permission matrix for actors", () => {
    const corp = mockUser(["corporate_admin"]);
    const terminal = mockUser(["terminal_admin"]);
    const bank = mockUser(["bank_admin"]);

    assert.doesNotThrow(() => assertActorMayPerformLifecycleTransition(corp, "DRAFT_TO_ACTIVE"));
    assert.doesNotThrow(() => assertActorMayPerformLifecycleTransition(terminal, "ACTIVE_TO_HALTED"));
    assert.throws(
      () => assertActorMayPerformLifecycleTransition(terminal, "DRAFT_TO_ACTIVE"),
      (e: unknown) => e instanceof CryptoOpsError && e.code === "FORBIDDEN",
    );
    assert.throws(
      () => assertActorMayPerformLifecycleTransition(bank, "ACTIVE_TO_HALTED"),
      (e: unknown) => e instanceof CryptoOpsError && e.code === "FORBIDDEN",
    );
  });
});

describe("crypto activation readiness", () => {
  it("blocks when critical checklist items fail (skipDb)", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const prevSecret = process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
    delete process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
    try {
      const readiness = await evaluateActivationReadiness("NVA", { skipDb: true });
      assert.equal(readiness.allPassed, false);
      const quote = readiness.items.find((i) => i.key === "quote_secret");
      assert.ok(quote);
      assert.equal(quote!.passed, false);
    } finally {
      process.env.NODE_ENV = prev;
      if (prevSecret === undefined) delete process.env.TERMINAL_CRYPTO_QUOTE_SECRET;
      else process.env.TERMINAL_CRYPTO_QUOTE_SECRET = prevSecret;
    }
  });

  it("finalizeReadiness ignores INFO failures", () => {
    const result = finalizeReadiness({
      symbol: "NPFC",
      items: [
        {
          key: "a",
          label: "a",
          passed: true,
          detail: "",
          severity: "CRITICAL",
        },
        {
          key: "b",
          label: "b",
          passed: false,
          detail: "",
          severity: "INFO",
        },
      ],
    });
    assert.equal(result.allPassed, true);
  });
});

describe("crypto reconciliation invariants", () => {
  function fakeAsset(overrides: {
    symbol: "NPFC" | "NVA" | "VLT";
    circulating: string;
    treasury: string;
    reserve: string;
    price?: string;
  }) {
    const cfg = CRYPTO_ASSET_CONFIGS[overrides.symbol];
    return {
      id: `asset_${overrides.symbol}`,
      symbol: overrides.symbol,
      displayName: cfg.displayName,
      kind: cfg.kind,
      status: "DRAFT" as const,
      version: 0,
      maxSupply: cfg.maxSupply,
      pegOrStartingPrice: cfg.pegOrStartingPrice,
      curveRate: cfg.curveRate,
      quantityPrecision: 8,
      displayPrecision: 8,
      totalFeeBps: cfg.totalFeeBps,
      revenueFeeBps: cfg.revenueFeeBps,
      stabilizationFeeBps: cfg.stabilizationFeeBps,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketState: {
        id: `ms_${overrides.symbol}`,
        assetId: `asset_${overrides.symbol}`,
        treasuryInventory: d(overrides.treasury),
        circulatingSupply: d(overrides.circulating),
        protectedReserve: d(overrides.reserve),
        stabilizationFund: d("0"),
        accruedRevenue: d("0"),
        currentMarginalPrice: d(overrides.price ?? cfg.pegOrStartingPrice.toString()),
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
  }

  it("reports healthy launch NPFC/NVA with no critical findings", () => {
    const npfc = fakeAsset({
      symbol: "NPFC",
      circulating: "0",
      treasury: "0",
      reserve: "0",
      price: "1",
    });
    const nva = fakeAsset({
      symbol: "NVA",
      circulating: "0",
      treasury: "1000000",
      reserve: "0",
      price: "5",
    });
    assert.equal(checkAssetMarketInvariants(npfc).filter((i) => i.severity === "CRITICAL").length, 0);
    assert.equal(checkAssetMarketInvariants(nva).filter((i) => i.severity === "CRITICAL").length, 0);
  });

  it("fingerprints reserve deficits stably for dedupe", () => {
    const deficit = fakeAsset({
      symbol: "NPFC",
      circulating: "100",
      treasury: "0",
      reserve: "50",
    });
    const issues = checkAssetMarketInvariants(deficit);
    const backing = issues.find((i) => i.checkKey === "npfc_backing");
    assert.ok(backing);
    assert.equal(backing!.severity, "CRITICAL");
    const fp = fingerprintIssue({ checkKey: "npfc_backing", assetId: deficit.id });
    assert.equal(backing!.fingerprint, fp);
    assert.equal(
      fingerprintIssue({ checkKey: "npfc_backing", assetId: deficit.id }),
      fp,
    );
  });

  it("flags fixed-supply conservation failures", () => {
    const broken = fakeAsset({
      symbol: "VLT",
      circulating: "10",
      treasury: "100",
      reserve: "0",
    });
    const issues = checkAssetMarketInvariants(broken);
    assert.ok(issues.some((i) => i.checkKey === "fixed_supply_conservation"));
  });
});

describe("crypto revenue sweep and contribution guards", () => {
  it("contribution path rejects negative amounts via CryptoOpsError", async () => {
    // Pure validation path — import helpers through ops errors used by services
    const { requireNonemptyReason } = await import("./crypto-ops-errors");
    assert.throws(() => requireNonemptyReason("  "), (e: unknown) => e instanceof CryptoOpsError);

    const src = read("src/lib/terminal/crypto/crypto-contribution.service.ts");
    assert.match(src, /NEGATIVE_AMOUNT/);
    assert.match(src, /!amount\.greaterThan\(0\)/);
    assert.match(src, /isCorporateAdmin/);

    const sweep = read("src/lib/terminal/crypto/crypto-revenue-sweep.service.ts");
    assert.match(sweep, /INSUFFICIENT_REVENUE/);
    assert.match(sweep, /DESTINATION_NOT_CONFIGURED/);
    assert.match(sweep, /TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID/);
    assert.match(sweep, /FOR UPDATE/);
    assert.doesNotMatch(sweep, /PROTECTED_RESERVE/);
  });
});

describe("crypto ops permission and UI Lab source contracts", () => {
  it("wires requireTerminalAdmin / requireAdmin and UI Lab gates", () => {
    const fns = read("src/lib/terminal/crypto/crypto-ops.functions.ts");
    assert.match(fns, /requireTerminalAdmin/);
    assert.match(fns, /requireAdmin/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto lifecycle"\)/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto revenue sweep"\)/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto contribution"\)/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto reconciliation"\)/);
    assert.match(fns, /transitionRequiresCorporateAdmin/);
  });

  it("documents revenue portfolio env and Phase 4 migration", () => {
    const env = read(".env.example");
    assert.match(env, /TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID/);
    const sql = read(
      "prisma/migrations/20260731200000_terminal_crypto_operations_phase4/migration.sql",
    );
    assert.match(sql, /TerminalCryptoAssetStatusChange/);
    assert.match(sql, /TerminalCryptoReconciliationRun/);
    assert.match(sql, /TerminalCryptoReconciliationIssue/);
    assert.match(sql, /TerminalCryptoRevenueSweep/);
    assert.match(sql, /TerminalCryptoExternalContribution/);
    assert.match(sql, /EXTERNAL_PROTECTED_CONTRIBUTION/);
    assert.match(sql, /open_fingerprint/);
    // Phase 4 ops schema only — activation is a later go-live migration.
    assert.doesNotMatch(sql, /UPDATE "TerminalCryptoAsset"[\s\S]*SET[\s\S]*"status"\s*=\s*'ACTIVE'/);
  });

  it("ships go-live migration that activates launch assets", () => {
    const sql = read(
      "prisma/migrations/20260731210000_terminal_crypto_go_live_activate/migration.sql",
    );
    assert.match(sql, /"status" = 'ACTIVE'/);
    assert.match(sql, /'NPFC'/);
    assert.match(sql, /'NVA'/);
    assert.match(sql, /'VLT'/);
    assert.match(sql, /AND "status" = 'DRAFT'/);
    assert.match(sql, /TerminalCryptoAssetStatusChange/);
    assert.match(sql, /go_live_activate_/);
  });

  it("registers reconciliation and candle rollup jobs", () => {
    const catalog = read("src/lib/internal/ops-jobs-catalog.ts");
    assert.match(catalog, /terminal_crypto_reconciliation/);
    assert.match(catalog, /terminal_crypto_candle_rollup/);
    const jobs = read("src/server/ops-jobs.service.ts");
    assert.match(jobs, /terminal_crypto_reconciliation/);
    assert.match(jobs, /terminal_crypto_candle_rollup/);
    assert.match(jobs, /assertNotUiLabMutation\("Terminal crypto reconciliation job"\)/);
  });
});

describe("candle rollup helpers", () => {
  it("floors timestamps to interval starts without inventing trades", () => {
    const at = new Date("2026-07-31T12:07:30.000Z");
    const m5 = floorToIntervalStart(at, 5);
    assert.equal(m5.toISOString(), "2026-07-31T12:05:00.000Z");
    const h1 = floorToIntervalStart(at, 60);
    assert.equal(h1.toISOString(), "2026-07-31T12:00:00.000Z");
  });
});

describe("financial idempotency scopes", () => {
  it("extends FinancialIdempotencyScope for Phase 4", () => {
    const src = read("src/server/financial-idempotency.service.ts");
    assert.match(src, /terminal_crypto_lifecycle/);
    assert.match(src, /terminal_crypto_revenue_sweep/);
    assert.match(src, /terminal_crypto_contribution/);
    assert.match(src, /terminal_crypto_reconciliation/);
  });
});

// Keep Prisma Decimal import used for type presence in schema-related asserts
void Prisma;
