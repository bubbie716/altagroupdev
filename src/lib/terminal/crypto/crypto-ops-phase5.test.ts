/**
 * Phase 5 — Terminal crypto operations & admin controls.
 * Focused authorization, config surface, UI Lab gates, readiness honesty.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { formatOpsAuditActionTitle } from "@/lib/internal/ops-activity-title";
import {
  terminalReadinessCategory,
  terminalReadinessLabel,
} from "@/lib/terminal/terminal-desk";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 5 crypto ops — permissions and SoD", () => {
  it("maps fee config and reopen to corporate-only server functions", () => {
    const fns = read("src/lib/terminal/crypto/crypto-ops.functions.ts");
    assert.match(fns, /canConfigureFees:\s*corporate/);
    assert.match(fns, /canReopenIssues:\s*corporate/);
    assert.match(fns, /canResolveIssues:\s*true/);
    assert.match(fns, /updateCryptoFeeConfigFn/);
    assert.match(fns, /resolveCryptoReconIssueFn/);
    assert.match(fns, /reopenCryptoReconIssueFn/);
    assert.match(fns, /requireCorporateOps\(\)/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto fee configuration"\)/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto reconciliation issue resolve"\)/);
    assert.match(fns, /assertNotUiLabMutation\("Terminal crypto reconciliation issue reopen"\)/);
  });

  it("enforces corporate admin inside fee config and reopen services", () => {
    const config = read("src/lib/terminal/crypto/crypto-config.service.ts");
    const issues = read("src/lib/terminal/crypto/crypto-reconciliation-issue.service.ts");
    assert.match(config, /isCorporateAdmin\(actor\)/);
    assert.match(config, /VERSION_CONFLICT/);
    assert.match(config, /future_orders_only|future orders only/i);
    assert.match(issues, /isCorporateAdmin\(actor\)/);
    assert.match(issues, /assertTerminalOpsActor/);
    assert.match(issues, /TERMINAL_CRYPTO_RECON_ISSUE_RESOLVED/);
    assert.match(issues, /TERMINAL_CRYPTO_RECON_ISSUE_REOPENED/);
  });

  it("keeps peg and curve read-only in config surface", () => {
    const config = read("src/lib/terminal/crypto/crypto-config.service.ts");
    assert.match(config, /mutable:\s*false/);
    assert.match(config, /migration/i);
    assert.doesNotMatch(config, /nextCurveRate:\s*input/);
  });
});

describe("Phase 5 crypto ops — reconciliation fingerprints", () => {
  it("refreshes lastSeenAt for recurring open fingerprints", () => {
    const recon = read("src/lib/terminal/crypto/crypto-reconciliation.service.ts");
    assert.match(recon, /lastSeenAt:\s*now/);
    assert.match(recon, /resolutionSource:\s*"auto_reconcile"/);
  });

  it("surfaces fingerprint and first/last seen on workspace issues", () => {
    const readSvc = read("src/lib/terminal/crypto/crypto-ops-read.service.ts");
    assert.match(readSvc, /fingerprint:\s*issue\.fingerprint/);
    assert.match(readSvc, /firstSeenAt:\s*issue\.createdAt/);
    assert.match(readSvc, /lastSeenAt:\s*issue\.lastSeenAt/);
    assert.match(readSvc, /recentlyResolvedIssues/);
    // INFO readiness must not pollute Needs attention
    assert.doesNotMatch(
      readSvc,
      /severity:\s*"INFO"[\s\S]{0,80}needsAttention\.push/,
    );
  });
});

describe("Phase 5 crypto ops — audit titles", () => {
  it("humanizes crypto admin audit actions", () => {
    assert.equal(
      formatOpsAuditActionTitle("TERMINAL_CRYPTO_FEE_CONFIG_UPDATED"),
      "Crypto fee configuration updated",
    );
    assert.equal(
      formatOpsAuditActionTitle("TERMINAL_CRYPTO_STATUS_HALTED"),
      "Crypto trading halted",
    );
    assert.equal(
      formatOpsAuditActionTitle("TERMINAL_CRYPTO_RECON_ISSUE_RESOLVED"),
      "Crypto reconciliation issue resolved",
    );
    assert.equal(
      formatOpsAuditActionTitle("TERMINAL_CRYPTO_REVENUE_SWEEP"),
      "Crypto revenue swept",
    );
  });
});

describe("Phase 5 crypto ops — system readiness honesty", () => {
  it("labels blocked Newport systems distinctly from ready", () => {
    assert.equal(terminalReadinessLabel("blocked_by_newport"), "Blocked by Newport/TSE");
    assert.equal(terminalReadinessLabel("demonstration_only"), "Demonstration only");
    assert.equal(terminalReadinessLabel("ready"), "Available now");
    assert.equal(terminalReadinessCategory("blocked_by_newport"), "blocked_by_newport");
    assert.equal(terminalReadinessCategory("ready"), "available_now");
  });

  it("system status separates crypto recon from TSE custody recon", () => {
    const admin = read("src/lib/terminal/terminal-ops-admin.service.ts");
    const page = read("src/routes/internal/terminal/system.tsx");
    assert.match(admin, /cryptoReconciliation:/);
    assert.match(admin, /newportLiveMarket:/);
    assert.match(admin, /configurationSecrets:/);
    assert.match(admin, /backupReadiness:/);
    assert.match(admin, /never displayed|never reveal|value never displayed/i);
    assert.match(page, /Blocked by Newport\/TSE/);
    assert.match(page, /Available now/);
    assert.match(page, /Demonstration only/);
  });
});

describe("Phase 5 crypto ops — UI Lab gates and scenarios", () => {
  it("adds required demonstration scenarios without enabling mutations", () => {
    const fixtures = read("src/lib/terminal/ui-lab/ui-lab-crypto-ops-fixtures.ts");
    for (const scenario of [
      "active_healthy",
      "halted",
      "redemption_only",
      "warning_issue",
      "permission_denied",
      "version_conflict",
      "insufficient_reserve",
      "server_failure",
      "idempotent_replay",
    ]) {
      assert.match(fixtures, new RegExp(`"${scenario}"`));
    }
    assert.match(fixtures, /getUiLabCryptoOpsProcessDemo/);
    assert.match(fixtures, /getUiLabCryptoConfigSurface/);
  });

  it("workspace UI disables mutations in UI Lab with explanation", () => {
    const view = read(
      "src/components/internal/workspace/terminal-crypto-asset-workspace-view.tsx",
    );
    assert.match(view, /Disabled in UI Lab/);
    assert.match(view, /updateCryptoFeeConfigFn/);
    assert.match(view, /resolveCryptoReconIssueFn/);
    assert.match(view, /reopenCryptoReconIssueFn/);
    assert.match(view, /future orders only/i);
    assert.match(view, /Review summary/);
  });
});

describe("Phase 5 crypto ops — execution transaction budget", () => {
  it("keeps interactive crypto fill transactions above the Prisma default timeout", () => {
    const src = read("src/lib/terminal/crypto/terminal-crypto-execution.service.ts");
    assert.match(src, /CRYPTO_ORDER_TXN_OPTIONS/);
    assert.match(src, /timeout:\s*60_000/);
    assert.match(src, /maxWait:\s*20_000/);
    assert.match(src, /CRYPTO_ORDER_TXN_OPTIONS\)/);
  });
});

describe("Phase 5 crypto ops — schema migration", () => {
  it("adds config change table and issue review columns", () => {
    const sql = read(
      "prisma/migrations/20260802200000_terminal_crypto_operations_phase5/migration.sql",
    );
    const schema = read("prisma/schema.prisma");
    assert.match(sql, /TerminalCryptoAssetConfigChange/);
    assert.match(sql, /lastSeenAt/);
    assert.match(sql, /TERMINAL_CRYPTO_CONFIG/);
    assert.match(schema, /model TerminalCryptoAssetConfigChange/);
    assert.match(schema, /lastSeenAt/);
    assert.match(schema, /TERMINAL_CRYPTO_RECON_ISSUE/);
  });

  it("documents disaster-recovery readiness", () => {
    const dr = read("docs/terminal-crypto-disaster-recovery.md");
    assert.match(dr, /TerminalCryptoAssetConfigChange/);
    assert.match(dr, /TERMINAL_CRYPTO_QUOTE_SECRET/);
    assert.match(dr, /never|Do not paste secrets/i);
    assert.match(dr, /20260802200000_terminal_crypto_operations_phase5/);
  });
});
