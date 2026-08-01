import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const schemaPath = join(repoRoot, "prisma/schema.prisma");
const migrationDir = join(
  repoRoot,
  "prisma/migrations/20260731140000_terminal_crypto_market_foundation",
);
const cryptoLibDir = join(repoRoot, "src/lib/terminal/crypto");

describe("crypto schema foundation guards", () => {
  it("adds crypto wallet balances separate from TerminalPosition", () => {
    const schema = readFileSync(schemaPath, "utf8");
    assert.match(schema, /model TerminalCryptoWalletBalance/);
    assert.match(schema, /model TerminalCryptoWallet/);
    assert.match(schema, /model TerminalCryptoAsset/);
    assert.match(schema, /model TerminalCryptoMarketState/);
    assert.match(schema, /model TerminalCryptoOrderSettlement/);
    assert.match(schema, /model TerminalCryptoMarketLedgerEntry/);
    assert.match(schema, /model TerminalCryptoPriceCandle/);

    // TerminalPosition remains TSE-stock only and documents the crypto exclusion.
    assert.match(schema, /Crypto holdings MUST NOT be stored here/);
    const positionBlock = schema.match(/model TerminalPosition \{[\s\S]*?\n\}/)?.[0] ?? "";
    assert.ok(positionBlock.length > 0, "TerminalPosition model block missing");
    assert.doesNotMatch(positionBlock, /TerminalCrypto/);
    assert.doesNotMatch(positionBlock, /^\s+crypto/m);
    assert.match(positionBlock, /quantity\s+Decimal/);
    assert.match(positionBlock, /averageCost\s+Decimal/);
  });

  it("extends TerminalOrder with instrument kind and execution venue defaults", () => {
    const schema = readFileSync(schemaPath, "utf8");
    assert.match(schema, /enum TerminalInstrumentKind/);
    assert.match(schema, /enum TerminalExecutionVenue/);
    assert.match(schema, /instrumentKind\s+TerminalInstrumentKind\s+@default\(STOCK\)/);
    assert.match(schema, /executionVenue\s+TerminalExecutionVenue\s+@default\(TSE\)/);
  });

  it("raises shared order/fill/activity price precision for crypto", () => {
    const schema = readFileSync(schemaPath, "utf8");
    assert.match(schema, /limitPrice\s+Decimal\?\s+@db\.Decimal\(28, 12\)/);
    assert.match(schema, /averageFillPrice\s+Decimal\?\s+@db\.Decimal\(28, 12\)/);
    const fillBlock = schema.slice(schema.indexOf("model TerminalOrderFill"));
    assert.match(fillBlock, /price\s+Decimal\s+@db\.Decimal\(28, 12\)/);
  });

  it("ships a forward-only crypto foundation migration that seeds DRAFT assets", () => {
    const sql = readFileSync(join(migrationDir, "migration.sql"), "utf8");
    assert.match(sql, /TerminalCryptoAsset/);
    assert.match(sql, /TerminalCryptoWallet/);
    assert.match(sql, /TerminalCryptoMarketState/);
    assert.match(sql, /'DRAFT'/);
    assert.match(sql, /INSERT INTO "TerminalCryptoAsset"/);
    assert.match(sql, /'NPFC'/);
    assert.match(sql, /'NVA'/);
    assert.match(sql, /'VLT'/);
    // Phase 1 foundation seed stays DRAFT; activation is a later go-live migration.
    assert.doesNotMatch(sql, /INSERT INTO "TerminalCryptoAsset"[\s\S]*'ACTIVE'/);
    assert.doesNotMatch(sql, /UPDATE "TerminalCryptoAsset"[\s\S]*SET[\s\S]*"status"\s*=\s*'ACTIVE'/);
    assert.match(sql, /instrumentKind/);
    assert.match(sql, /executionVenue/);
    assert.match(sql, /DEFAULT 'STOCK'/);
    assert.match(sql, /DEFAULT 'TSE'/);
  });

  it("ships a go-live migration that activates NPFC/NVA/VLT from DRAFT", () => {
    const sql = readFileSync(
      join(repoRoot, "prisma/migrations/20260731210000_terminal_crypto_go_live_activate/migration.sql"),
      "utf8",
    );
    assert.match(sql, /SET[\s\S]*"status"\s*=\s*'ACTIVE'/);
    assert.match(sql, /'NPFC'/);
    assert.match(sql, /'NVA'/);
    assert.match(sql, /'VLT'/);
    assert.match(sql, /AND "status" = 'DRAFT'/);
    assert.match(sql, /TerminalCryptoAssetStatusChange/);
    assert.match(sql, /go_live_activate_npfc/);
    assert.match(sql, /system-crypto-go-live/);
    assert.match(sql, /ON CONFLICT \("assetId", "idempotencyKey"\) DO NOTHING/);
  });

  it("ships a nondestructive curve recalibration migration for NVA/VLT", () => {
    const sql = readFileSync(
      join(
        repoRoot,
        "prisma/migrations/20260731220000_terminal_crypto_curve_recalibration/migration.sql",
      ),
      "utf8",
    );
    assert.match(sql, /0\.000252651515151515/);
    assert.match(sql, /0\.000000252840909091/);
    assert.match(sql, /NONDESTRUCTIVE/);
    assert.doesNotMatch(sql, /DELETE FROM/);
  });

  it("does not remove instrument/venue defaults for existing stock records", () => {
    const sql = readFileSync(join(migrationDir, "migration.sql"), "utf8");
    assert.match(
      sql,
      /ADD COLUMN "instrumentKind" "TerminalInstrumentKind" NOT NULL DEFAULT 'STOCK'/,
    );
    assert.match(
      sql,
      /ADD COLUMN "executionVenue" "TerminalExecutionVenue" NOT NULL DEFAULT 'TSE'/,
    );
  });
});

describe("crypto pricing engine source guards", () => {
  it("forbids floating-point authoritative math in the pricing engine", () => {
    const files = readdirSync(cryptoLibDir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "index.ts",
    );
    for (const file of files) {
      // Entropy helper and presentation/read/ops adapters are outside the pure pricing engine.
      if (
        file === "crypto-wallet-id.ts" ||
        file === "crypto-market-read.service.ts" ||
        file === "crypto-market.functions.ts" ||
        file === "crypto-instrument.ts" ||
        file === "crypto-format.ts" ||
        file === "crypto-impact-ack.ts" ||
        file === "portfolio-allocation.ts" ||
        file === "crypto-ops-ui.ts" ||
        file === "crypto-ops-read.service.ts" ||
        file === "crypto-ops.functions.ts" ||
        file === "crypto-ops-errors.ts" ||
        file === "crypto-lifecycle.service.ts" ||
        file === "crypto-activation-readiness.service.ts" ||
        file === "crypto-reconciliation.service.ts" ||
        file === "crypto-revenue-sweep.service.ts" ||
        file === "crypto-contribution.service.ts" ||
        file === "crypto-candle-rollup.service.ts" ||
        file === "crypto-portfolio-history.ts" ||
        file === "crypto-portfolio-history.service.ts" ||
        file.startsWith("terminal-crypto-")
      ) {
        continue;
      }
      const src = readFileSync(join(cryptoLibDir, file), "utf8");
      assert.doesNotMatch(src, /\bparseFloat\s*\(/);
      assert.doesNotMatch(src, /\bMath\.(sqrt|pow|floor|ceil|round|abs|min|max)\s*\(/);
      // No bare number arithmetic assigned into financial results via `as number`
      assert.doesNotMatch(src, /as number/);
    }

    const pricing = readFileSync(join(cryptoLibDir, "crypto-pricing.ts"), "utf8");
    assert.doesNotMatch(pricing, /from ["']@prisma\/client["'][\s\S]*prisma\./i);
    assert.doesNotMatch(pricing, /\bprisma\./);
    assert.match(pricing, /Prisma\.Decimal|from "\.\/crypto-decimal"/);

    const decimalHelper = readFileSync(join(cryptoLibDir, "crypto-decimal.ts"), "utf8");
    assert.match(decimalHelper, /rejects JavaScript number inputs/);
  });

  it("pure pricing module does not import Prisma client for IO", () => {
    const pricing = readFileSync(join(cryptoLibDir, "crypto-pricing.ts"), "utf8");
    const curve = readFileSync(join(cryptoLibDir, "crypto-curve-math.ts"), "utf8");
    assert.doesNotMatch(pricing, /PrismaClient/);
    assert.doesNotMatch(curve, /PrismaClient/);
    assert.doesNotMatch(pricing, /\$transaction|findUnique|create\(/);
  });

  it("phase 1 seed helper refuses to mark assets ACTIVE", () => {
    const seed = readFileSync(join(cryptoLibDir, "crypto-assets.seed.ts"), "utf8");
    assert.match(seed, /status: "DRAFT"/);
    assert.doesNotMatch(seed, /status:\s*"ACTIVE"/);
  });
});
