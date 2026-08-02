/**
 * Database-backed Terminal crypto concurrency / settlement tests (Phase 2).
 *
 * Requires DATABASE_URL and migrations through
 * `20260731160000_terminal_crypto_execution_hardening`.
 *
 * Launch assets may be ACTIVE after go-live migration. These tests temporarily set
 * isolated fixture rows to ACTIVE inside the test DB only (never a runtime bypass).
 *
 *   npx tsx --test src/lib/terminal/crypto/terminal-crypto-order.concurrency.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before } from "node:test";

function loadDotEnvDatabaseUrl(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "../../.."),
    process.cwd(),
  ];
  for (const root of candidates) {
    const envPath = join(root, ".env");
    if (!existsSync(envPath)) continue;
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = /^DATABASE_URL\s*=\s*(.*)$/.exec(trimmed);
      if (!match) continue;
      let value = match[1]!.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) {
        process.env.DATABASE_URL = value;
        return;
      }
    }
  }
}

loadDotEnvDatabaseUrl();
if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";
process.env.STAFF_AUDIT_DISCORD_DISABLED = "1";
process.env.VITEST = process.env.VITEST ?? "true";

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function suffix(): string {
  return randomBytes(6).toString("hex");
}

const skipSuite = !hasDatabaseUrl();

describe("terminal crypto order concurrency (database)", { skip: skipSuite }, () => {
  let prisma: typeof import("@/server/db").prisma;
  let loadAltaUserOrThrow: typeof import("@/server/bank-account-access.service").loadAltaUserOrThrow;
  let previewTerminalCryptoOrder: typeof import("./terminal-crypto-preview.service").previewTerminalCryptoOrder;
  let submitTerminalCryptoOrder: typeof import("./terminal-crypto-execution.service").submitTerminalCryptoOrder;
  let tableReady = false;
  let skipReason = "Terminal crypto Phase 2 tables missing — apply migrations first";

  before(async () => {
    const refreshHooks = await import("@/server/relationship-refresh-hooks.service");
    refreshHooks.disableRelationshipBackgroundRefresh();

    const db = await import("@/server/db");
    prisma = db.prisma;

    try {
      await prisma.$queryRaw`SELECT 1 FROM "TerminalCryptoOrderSettlement" LIMIT 1`;
      await prisma.$queryRaw`SELECT "accruedRevenue" FROM "TerminalCryptoMarketState" LIMIT 1`;
      await prisma.$queryRaw`SELECT 1 FROM "TerminalCryptoWalletLedgerEntry" LIMIT 1`;
      tableReady = true;
    } catch {
      tableReady = false;
      skipReason =
        "Migration-dependent: apply prisma migrations through 20260731160000_terminal_crypto_execution_hardening before running crypto concurrency tests";
      return;
    }

    const access = await import("@/server/bank-account-access.service");
    loadAltaUserOrThrow = access.loadAltaUserOrThrow;
    previewTerminalCryptoOrder = (await import("./terminal-crypto-preview.service"))
      .previewTerminalCryptoOrder;
    submitTerminalCryptoOrder = (await import("./terminal-crypto-execution.service"))
      .submitTerminalCryptoOrder;

    // Ensure launch assets exist (DRAFT), then tests activate only for the duration of each fixture use.
    const { ensureTerminalCryptoLaunchAssetsSeeded } = await import("./crypto-assets.seed");
    await ensureTerminalCryptoLaunchAssetsSeeded(prisma);
  });

  async function createPortfolioFixture(opts?: { terminalCash?: string; corporateAdmin?: boolean }) {
    const tag = suffix();
    const user = await prisma.user.create({
      data: {
        discordId: `discord-crypto-${tag}`,
        discordUsername: `crypto_${tag}`,
        minecraftUsername: `crypto_${tag}`,
        minecraftUuid: null,
        minecraftVerifiedAt: null,
        eligibilityConfirmedAt: new Date(),
        coreOnboardingCompletedAt: new Date(),
        onboardingCompletedAt: new Date(),
        ...(opts?.corporateAdmin
          ? { tags: { create: [{ tag: "CORPORATE_ADMIN" as const }] } }
          : {}),
      },
    });
    const portfolio = await prisma.terminalPortfolio.create({
      data: {
        name: `Crypto Book ${tag}`,
        ownerType: "PERSONAL",
        ownerUserId: user.id,
        createdByUserId: user.id,
        status: "ACTIVE",
        isDefault: true,
      },
    });
    await prisma.terminalPortfolioCashAccount.create({
      data: {
        portfolioId: portfolio.id,
        availableCash: opts?.terminalCash ?? "10000",
        reservedCash: 0,
        currency: "FLORIN",
        version: 0,
      },
    });

    const altaUser = await loadAltaUserOrThrow(user.id);
    return { user, portfolio, altaUser, tag };
  }

  type MarketSnapshot = {
    status: string;
    version: number;
    treasuryInventory: string;
    circulatingSupply: string;
    protectedReserve: string;
    stabilizationFund: string;
    accruedRevenue: string;
    currentMarginalPrice: string;
    marketVersion: number;
  };

  async function snapshotLaunchAsset(symbol: "NPFC" | "NVA" | "VLT"): Promise<MarketSnapshot> {
    const asset = await prisma.terminalCryptoAsset.findUniqueOrThrow({
      where: { symbol },
      include: { marketState: true },
    });
    assert.ok(asset.marketState);
    return {
      status: asset.status,
      version: asset.version,
      treasuryInventory: asset.marketState.treasuryInventory.toString(),
      circulatingSupply: asset.marketState.circulatingSupply.toString(),
      protectedReserve: asset.marketState.protectedReserve.toString(),
      stabilizationFund: asset.marketState.stabilizationFund.toString(),
      accruedRevenue: asset.marketState.accruedRevenue.toString(),
      currentMarginalPrice: asset.marketState.currentMarginalPrice.toString(),
      marketVersion: asset.marketState.version,
    };
  }

  async function restoreLaunchAsset(
    symbol: "NPFC" | "NVA" | "VLT",
    snap: MarketSnapshot,
    fixturePortfolioIds: string[],
  ): Promise<void> {
    // Remove only this test's customer residue for the fixture portfolios.
    if (fixturePortfolioIds.length > 0) {
      const orders = await prisma.terminalOrder.findMany({
        where: { portfolioId: { in: fixturePortfolioIds } },
        select: { id: true },
      });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await prisma.terminalCryptoMarketLedgerEntry.deleteMany({
          where: { settlement: { orderId: { in: orderIds } } },
        });
        await prisma.terminalCryptoOrderSettlement.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.terminalOrderFill.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.terminalPortfolioActivity.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.terminalCashLedgerEntry.deleteMany({
          where: { relatedOrderId: { in: orderIds } },
        });
        await prisma.terminalOrder.deleteMany({ where: { id: { in: orderIds } } });
      }
      const wallets = await prisma.terminalCryptoWallet.findMany({
        where: { portfolioId: { in: fixturePortfolioIds } },
        select: { id: true },
      });
      const walletIds = wallets.map((w) => w.id);
      if (walletIds.length > 0) {
        await prisma.terminalCryptoWalletLedgerEntry.deleteMany({
          where: { walletId: { in: walletIds } },
        });
        await prisma.terminalCryptoWalletBalance.deleteMany({
          where: { walletId: { in: walletIds } },
        });
        await prisma.terminalCryptoWallet.deleteMany({ where: { id: { in: walletIds } } });
      }
      await prisma.financialIdempotencyRecord.deleteMany({
        where: {
          scope: "terminal_crypto_order",
          OR: fixturePortfolioIds.map((portfolioId) => ({
            idempotencyKey: { startsWith: `${portfolioId}:` },
          })),
        },
      });
    }

    const asset = await prisma.terminalCryptoAsset.findUniqueOrThrow({ where: { symbol } });
    await prisma.terminalCryptoMarketState.update({
      where: { assetId: asset.id },
      data: {
        treasuryInventory: snap.treasuryInventory,
        circulatingSupply: snap.circulatingSupply,
        protectedReserve: snap.protectedReserve,
        stabilizationFund: snap.stabilizationFund,
        accruedRevenue: snap.accruedRevenue,
        currentMarginalPrice: snap.currentMarginalPrice,
        version: snap.marketVersion,
      },
    });
    await prisma.terminalCryptoAsset.update({
      where: { symbol },
      data: { status: snap.status as never, version: snap.version },
    });
  }

  async function withActiveAsset<T>(
    symbol: "NPFC" | "NVA" | "VLT",
    fixturePortfolioIds: string[],
    fn: () => Promise<T>,
  ): Promise<T> {
    return withActiveAssets([symbol], fixturePortfolioIds, fn);
  }

  /**
   * Activate multiple launch assets for one fixture body.
   * Residue cleanup runs once (last restore) so nested multi-asset buys
   * are not wiped mid-test by an inner restore.
   */
  async function withActiveAssets<T>(
    symbols: Array<"NPFC" | "NVA" | "VLT">,
    fixturePortfolioIds: string[],
    fn: () => Promise<T>,
  ): Promise<T> {
    const snaps = new Map<"NPFC" | "NVA" | "VLT", MarketSnapshot>();
    for (const symbol of symbols) {
      snaps.set(symbol, await snapshotLaunchAsset(symbol));
      await prisma.terminalCryptoAsset.update({
        where: { symbol },
        data: { status: "ACTIVE" },
      });
    }
    try {
      return await fn();
    } finally {
      for (let i = symbols.length - 1; i >= 0; i -= 1) {
        const symbol = symbols[i]!;
        const snap = snaps.get(symbol)!;
        // Only the final restore deletes fixture wallets/orders.
        await restoreLaunchAsset(
          symbol,
          snap,
          i === 0 ? fixturePortfolioIds : [],
        );
      }
    }
  }

  it("skips clearly when phase 2 migration is missing", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    assert.ok(tableReady);
  });

  it("preview does not create a wallet or mutate balances", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    const fixture = await createPortfolioFixture();
    await withActiveAsset("NVA", [fixture.portfolio.id], async () => {
      const beforeWallets = await prisma.terminalCryptoWallet.count({
        where: { portfolioId: fixture.portfolio.id },
      });
      const cashBefore = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: fixture.portfolio.id },
      });
      const preview = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
      });
      assert.ok(preview.quoteFingerprint);
      const afterWallets = await prisma.terminalCryptoWallet.count({
        where: { portfolioId: fixture.portfolio.id },
      });
      const cashAfter = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.equal(beforeWallets, 0);
      assert.equal(afterWallets, 0);
      assert.equal(cashBefore.availableCash.toString(), cashAfter.availableCash.toString());
    });
  });

  it("first purchase creates one wallet; second asset reuses it", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    const fixture = await createPortfolioFixture();
    // Keep both assets ACTIVE in one scope — nested withActiveAsset previously
    // wiped the shared wallet during the inner restore and amplified txn timeouts.
    await withActiveAssets(["NVA", "VLT"], [fixture.portfolio.id], async () => {
      const preview = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
      });
      const fill = await submitTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
        clientKey: `ck-nva-${fixture.tag}`,
        expectedMarketStateVersion: preview.marketStateVersion,
        quoteExpiresAt: preview.quoteExpiresAt,
        quoteFingerprint: preview.quoteFingerprint,
      });
      assert.equal(fill.ok, true);
      assert.equal(fill.replayed, false);
      const wallets = await prisma.terminalCryptoWallet.findMany({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.equal(wallets.length, 1);
      const walletId = wallets[0]!.id;

      const previewV = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "VLT",
        side: "BUY",
        grossFlorins: "100",
      });
      const fillV = await submitTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "VLT",
        side: "BUY",
        grossFlorins: "100",
        clientKey: `ck-vlt-${fixture.tag}`,
        expectedMarketStateVersion: previewV.marketStateVersion,
        quoteExpiresAt: previewV.quoteExpiresAt,
        quoteFingerprint: previewV.quoteFingerprint,
      });
      assert.equal(fillV.ok, true);
      const walletsAfter = await prisma.terminalCryptoWallet.findMany({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.equal(walletsAfter.length, 1);
      assert.equal(walletsAfter[0]!.id, walletId);
      const balances = await prisma.terminalCryptoWalletBalance.count({
        where: { walletId },
      });
      assert.ok(balances >= 2);
    });
  });

  it("identical idempotency key executes once; different payload conflicts", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    const fixture = await createPortfolioFixture();
    await withActiveAsset("NPFC", [fixture.portfolio.id], async () => {
      const preview = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NPFC",
        side: "BUY",
        grossFlorins: "50",
      });
      const key = `ck-idem-${fixture.tag}`;
      const input = {
        portfolioId: fixture.portfolio.id,
        symbol: "NPFC" as const,
        side: "BUY" as const,
        grossFlorins: "50",
        clientKey: key,
        expectedMarketStateVersion: preview.marketStateVersion,
        quoteExpiresAt: preview.quoteExpiresAt,
        quoteFingerprint: preview.quoteFingerprint,
      };

      const a = await submitTerminalCryptoOrder(fixture.altaUser, input);
      assert.equal(a.replayed, false);
      const b = await submitTerminalCryptoOrder(fixture.altaUser, input);
      assert.equal(a.orderId, b.orderId);
      assert.equal(b.replayed, true);

      const [c1, c2] = await Promise.all([
        submitTerminalCryptoOrder(fixture.altaUser, input),
        submitTerminalCryptoOrder(fixture.altaUser, input),
      ]);
      assert.equal(c1.orderId, a.orderId);
      assert.equal(c2.orderId, a.orderId);
      assert.equal(c1.replayed, true);
      assert.equal(c2.replayed, true);

      const orders = await prisma.terminalOrder.count({
        where: { portfolioId: fixture.portfolio.id, clientKey: key },
      });
      assert.equal(orders, 1);
      const fills = await prisma.terminalOrderFill.count({
        where: { order: { portfolioId: fixture.portfolio.id, clientKey: key } },
      });
      assert.equal(fills, 1);
      const settlements = await prisma.terminalCryptoOrderSettlement.count({
        where: { order: { portfolioId: fixture.portfolio.id, clientKey: key } },
      });
      assert.equal(settlements, 1);
      const cashEntries = await prisma.terminalCashLedgerEntry.count({
        where: { relatedOrderId: a.orderId },
      });
      // BUY posts TRADING_FEE + BUY_FILL (no double-count of gross).
      assert.equal(cashEntries, 2);
      const wallets = await prisma.terminalCryptoWallet.count({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.equal(wallets, 1);

      await assert.rejects(
        () =>
          submitTerminalCryptoOrder(fixture.altaUser, {
            ...input,
            grossFlorins: "51",
            quoteFingerprint: preview.quoteFingerprint,
          }),
        (err: unknown) =>
          err instanceof Error &&
          ((err as { code?: string }).code === "IDEMPOTENCY_CONFLICT" ||
            err.message.includes("IDEMPOTENCY_CONFLICT")),
      );
    });
  });

  it("two simultaneous first buys: one executes, stale quote requotes, retry reuses wallet", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    const fixture = await createPortfolioFixture({ terminalCash: "20000" });
    await withActiveAsset("NVA", [fixture.portfolio.id], async () => {
      const preview = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
      });
      const shared = {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA" as const,
        side: "BUY" as const,
        grossFlorins: "100",
        expectedMarketStateVersion: preview.marketStateVersion,
        quoteExpiresAt: preview.quoteExpiresAt,
        quoteFingerprint: preview.quoteFingerprint,
      };

      const settled = await Promise.allSettled([
        submitTerminalCryptoOrder(fixture.altaUser, {
          ...shared,
          clientKey: `ck-par-a-${fixture.tag}`,
        }),
        submitTerminalCryptoOrder(fixture.altaUser, {
          ...shared,
          clientKey: `ck-par-b-${fixture.tag}`,
        }),
      ]);

      const fulfilled = settled.filter((r) => r.status === "fulfilled");
      const rejected = settled.filter((r) => r.status === "rejected");
      assert.equal(fulfilled.length, 1, "exactly one submission should execute");
      assert.equal(rejected.length, 1, "exactly one submission should be rejected");
      const winner = (fulfilled[0] as PromiseFulfilledResult<{ orderId: string; replayed: boolean }>)
        .value;
      assert.equal(winner.replayed, false);
      const loser = (rejected[0] as PromiseRejectedResult).reason;
      assert.equal((loser as { code?: string }).code, "REQUOTE_REQUIRED");

      const walletsAfterFirst = await prisma.terminalCryptoWallet.count({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.equal(walletsAfterFirst, 1);

      const ordersAfterFirst = await prisma.terminalOrder.count({
        where: { portfolioId: fixture.portfolio.id, instrumentKind: "CRYPTO" },
      });
      assert.equal(ordersAfterFirst, 1);
      const settlementsAfterFirst = await prisma.terminalCryptoOrderSettlement.count({
        where: { order: { portfolioId: fixture.portfolio.id } },
      });
      assert.equal(settlementsAfterFirst, 1);

      const fresh = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
      });
      const retry = await submitTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
        clientKey: `ck-par-retry-${fixture.tag}`,
        expectedMarketStateVersion: fresh.marketStateVersion,
        quoteExpiresAt: fresh.quoteExpiresAt,
        quoteFingerprint: fresh.quoteFingerprint,
      });
      assert.equal(retry.ok, true);
      assert.equal(retry.replayed, false);
      assert.equal(retry.walletPublicId, (winner as { walletPublicId: string }).walletPublicId);

      const walletsFinal = await prisma.terminalCryptoWallet.count({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.equal(walletsFinal, 1);
      const ordersFinal = await prisma.terminalOrder.count({
        where: { portfolioId: fixture.portfolio.id, instrumentKind: "CRYPTO", status: "FILLED" },
      });
      assert.equal(ordersFinal, 2);
      const settlementsFinal = await prisma.terminalCryptoOrderSettlement.count({
        where: { order: { portfolioId: fixture.portfolio.id } },
      });
      assert.equal(settlementsFinal, 2);
      const wallet = await prisma.terminalCryptoWallet.findUniqueOrThrow({
        where: { portfolioId: fixture.portfolio.id },
        include: { balances: { where: { asset: { symbol: "NVA" } } } },
      });
      assert.ok(wallet.balances[0]);
      assert.ok(wallet.balances[0]!.availableQuantity.greaterThan(0));
    });
  });

  it("reconciles cash, reserve, revenue, wallet, order, fill, settlement, activity, candle", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    const fixture = await createPortfolioFixture();
    await withActiveAsset("NVA", [fixture.portfolio.id], async () => {
      const marketBefore = await prisma.terminalCryptoMarketState.findFirstOrThrow({
        where: { asset: { symbol: "NVA" } },
      });
      const cashBefore = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: fixture.portfolio.id },
      });
      const preview = await previewTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
      });
      const fill = await submitTerminalCryptoOrder(fixture.altaUser, {
        portfolioId: fixture.portfolio.id,
        symbol: "NVA",
        side: "BUY",
        grossFlorins: "100",
        clientKey: `ck-recon-${fixture.tag}`,
        expectedMarketStateVersion: preview.marketStateVersion,
        quoteExpiresAt: preview.quoteExpiresAt,
        quoteFingerprint: preview.quoteFingerprint,
      });

      const order = await prisma.terminalOrder.findUniqueOrThrow({
        where: { id: fill.orderId },
        include: { fills: true, cryptoSettlement: true, activity: true },
      });
      assert.equal(order.instrumentKind, "CRYPTO");
      assert.equal(order.executionVenue, "ALTA_CRYPTO");
      assert.equal(order.status, "FILLED");
      assert.equal(order.fills.length, 1);
      assert.ok(order.cryptoSettlement);

      const marketAfter = await prisma.terminalCryptoMarketState.findFirstOrThrow({
        where: { asset: { symbol: "NVA" } },
      });
      assert.ok(marketAfter.accruedRevenue.greaterThan(marketBefore.accruedRevenue));
      assert.ok(marketAfter.protectedReserve.greaterThan(marketBefore.protectedReserve));
      assert.ok(
        marketAfter.treasuryInventory
          .plus(marketAfter.circulatingSupply)
          .equals(marketBefore.treasuryInventory.plus(marketBefore.circulatingSupply)),
      );

      const cashAfter = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: fixture.portfolio.id },
      });
      assert.ok(cashAfter.availableCash.lessThan(cashBefore.availableCash));

      const positions = await prisma.terminalPosition.count({
        where: { portfolioId: fixture.portfolio.id, symbol: "NVA" },
      });
      assert.equal(positions, 0);

      const ledgerCount = await prisma.terminalCryptoMarketLedgerEntry.count({
        where: { settlementId: order.cryptoSettlement!.id },
      });
      assert.ok(ledgerCount >= 3);

      const walletLedger = await prisma.terminalCryptoWalletLedgerEntry.count({
        where: { settlementId: order.cryptoSettlement!.id },
      });
      assert.equal(walletLedger, 1);

      const candles = await prisma.terminalCryptoPriceCandle.count({
        where: { asset: { symbol: "NVA" }, interval: "M1" },
      });
      assert.ok(candles >= 1);
      assert.ok(order.activity.length >= 1);
    });
  });

  it("draft assets remain rejected by production services", async (t) => {
    if (!tableReady) {
      t.skip(skipReason);
      return;
    }
    const fixture = await createPortfolioFixture();
    const prior = await prisma.terminalCryptoAsset.findUniqueOrThrow({
      where: { symbol: "NVA" },
      select: { status: true, version: true },
    });
    try {
      await prisma.terminalCryptoAsset.update({
        where: { symbol: "NVA" },
        data: { status: "DRAFT" },
      });
      await assert.rejects(
        () =>
          previewTerminalCryptoOrder(fixture.altaUser, {
            portfolioId: fixture.portfolio.id,
            symbol: "NVA",
            side: "BUY",
            grossFlorins: "100",
          }),
        (err: unknown) => (err as { code?: string }).code === "ASSET_DRAFT",
      );
    } finally {
      // Restore prior launch status so this suite never leaves NVA stuck in DRAFT.
      await prisma.terminalCryptoAsset.update({
        where: { symbol: "NVA" },
        data: { status: prior.status as "DRAFT" | "ACTIVE" | "HALTED" | "RETIRED" },
      });
    }
  });
});

describe("terminal crypto Phase 4 concurrency (database)", { skip: skipSuite }, () => {
  let prisma: typeof import("@/server/db").prisma;
  let loadAltaUserOrThrow: typeof import("@/server/bank-account-access.service").loadAltaUserOrThrow;
  let previewTerminalCryptoOrder: typeof import("./terminal-crypto-preview.service").previewTerminalCryptoOrder;
  let submitTerminalCryptoOrder: typeof import("./terminal-crypto-execution.service").submitTerminalCryptoOrder;
  let sweepCryptoRevenue: typeof import("./crypto-revenue-sweep.service").sweepCryptoRevenue;
  let transitionCryptoAssetStatus: typeof import("./crypto-lifecycle.service").transitionCryptoAssetStatus;
  let runCryptoReconciliation: typeof import("./crypto-reconciliation.service").runCryptoReconciliation;
  let fingerprintIssue: typeof import("./crypto-reconciliation.service").fingerprintIssue;
  let phase4Ready = false;
  const phase4SkipReason =
    "Migration-dependent: apply prisma migrations through 20260731200000_terminal_crypto_operations_phase4 before running Phase 4 concurrency tests";

  before(async () => {
    if (!hasDatabaseUrl()) return;
    const refreshHooks = await import("@/server/relationship-refresh-hooks.service");
    refreshHooks.disableRelationshipBackgroundRefresh();
    const db = await import("@/server/db");
    prisma = db.prisma;
    try {
      await prisma.$queryRaw`SELECT 1 FROM "TerminalCryptoRevenueSweep" LIMIT 1`;
      await prisma.$queryRaw`SELECT 1 FROM "TerminalCryptoAssetStatusChange" LIMIT 1`;
      await prisma.$queryRaw`SELECT 1 FROM "TerminalCryptoReconciliationIssue" LIMIT 1`;
      await prisma.$queryRaw`SELECT "version" FROM "TerminalCryptoAsset" LIMIT 1`;
      phase4Ready = true;
    } catch {
      phase4Ready = false;
      return;
    }
    loadAltaUserOrThrow = (await import("@/server/bank-account-access.service")).loadAltaUserOrThrow;
    previewTerminalCryptoOrder = (await import("./terminal-crypto-preview.service"))
      .previewTerminalCryptoOrder;
    submitTerminalCryptoOrder = (await import("./terminal-crypto-execution.service"))
      .submitTerminalCryptoOrder;
    sweepCryptoRevenue = (await import("./crypto-revenue-sweep.service")).sweepCryptoRevenue;
    transitionCryptoAssetStatus = (await import("./crypto-lifecycle.service"))
      .transitionCryptoAssetStatus;
    const recon = await import("./crypto-reconciliation.service");
    runCryptoReconciliation = recon.runCryptoReconciliation;
    fingerprintIssue = recon.fingerprintIssue;
    const { ensureTerminalCryptoLaunchAssetsSeeded } = await import("./crypto-assets.seed");
    await ensureTerminalCryptoLaunchAssetsSeeded(prisma);
  });

  async function createCorpActor(tag: string) {
    const user = await prisma.user.create({
      data: {
        discordId: `discord-corp-${tag}`,
        discordUsername: `corp_${tag}`,
        minecraftUsername: `corp_${tag}`,
        eligibilityConfirmedAt: new Date(),
        coreOnboardingCompletedAt: new Date(),
        onboardingCompletedAt: new Date(),
        tags: { create: [{ tag: "CORPORATE_ADMIN" }] },
      },
    });
    return loadAltaUserOrThrow(user.id);
  }

  async function createRevenueDestination(tag: string) {
    const owner = await prisma.user.create({
      data: {
        discordId: `discord-revdest-${tag}`,
        discordUsername: `revdest_${tag}`,
        minecraftUsername: `revdest_${tag}`,
        eligibilityConfirmedAt: new Date(),
        coreOnboardingCompletedAt: new Date(),
        onboardingCompletedAt: new Date(),
      },
    });
    const portfolio = await prisma.terminalPortfolio.create({
      data: {
        name: `Crypto Revenue ${tag}`,
        ownerType: "PERSONAL",
        ownerUserId: owner.id,
        createdByUserId: owner.id,
        status: "ACTIVE",
        isDefault: false,
      },
    });
    await prisma.terminalPortfolioCashAccount.create({
      data: {
        portfolioId: portfolio.id,
        availableCash: "0",
        reservedCash: 0,
        currency: "FLORIN",
        version: 0,
      },
    });
    return { owner, portfolio };
  }

  async function createIsolatedAsset(opts: {
    tag: string;
    status?: "DRAFT" | "ACTIVE" | "HALTED";
    accruedRevenue?: string;
    circulatingSupply?: string;
    treasuryInventory?: string;
    protectedReserve?: string;
    /** When set, creates an intentional STABLE undercollateralization for recon tests. */
    undercollateralized?: boolean;
  }) {
    const symbol = `X${opts.tag.slice(0, 7)}`.toUpperCase();
    const circulating = opts.circulatingSupply ?? "0";
    const protectedReserve =
      opts.protectedReserve ??
      (opts.undercollateralized ? "1" : circulating === "0" ? "0" : circulating);
    const asset = await prisma.terminalCryptoAsset.create({
      data: {
        symbol,
        displayName: `Fixture ${symbol}`,
        kind: "STABLE",
        status: opts.status ?? "ACTIVE",
        version: 0,
        // STABLE assets require null maxSupply + null curveRate (DB check constraint).
        maxSupply: null,
        pegOrStartingPrice: "1",
        curveRate: null,
        quantityPrecision: 8,
        displayPrecision: 2,
        totalFeeBps: 10,
        revenueFeeBps: 10,
        stabilizationFeeBps: 0,
        marketState: {
          create: {
            treasuryInventory: opts.treasuryInventory ?? "0",
            circulatingSupply: circulating,
            protectedReserve,
            stabilizationFund: "0",
            accruedRevenue: opts.accruedRevenue ?? "0",
            currentMarginalPrice: "1",
            version: 0,
          },
        },
      },
      include: { marketState: true },
    });
    return {
      asset,
      symbol,
      async cleanup() {
        await prisma.terminalCryptoRevenueSweep.deleteMany({ where: { assetId: asset.id } });
        await prisma.terminalCryptoExternalContribution.deleteMany({
          where: { assetId: asset.id },
        });
        await prisma.terminalCryptoAssetStatusChange.deleteMany({ where: { assetId: asset.id } });
        await prisma.terminalCryptoReconciliationIssue.deleteMany({ where: { assetId: asset.id } });
        await prisma.terminalCryptoMarketLedgerEntry.deleteMany({ where: { assetId: asset.id } });
        await prisma.terminalCryptoPriceCandle.deleteMany({ where: { assetId: asset.id } });
        await prisma.terminalCryptoMarketState.deleteMany({ where: { assetId: asset.id } });
        await prisma.terminalCryptoAsset.delete({ where: { id: asset.id } });
      },
    };
  }

  it("concurrent revenue sweeps cannot overdraw accrued revenue", async (t) => {
    if (!phase4Ready) {
      t.skip(phase4SkipReason);
      return;
    }
    const tag = suffix();
    const actor = await createCorpActor(tag);
    const dest = await createRevenueDestination(tag);
    const prevDest = process.env.TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID;
    process.env.TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID = dest.portfolio.id;
    const isolated = await createIsolatedAsset({
      tag,
      accruedRevenue: "10.00",
      protectedReserve: "0",
      treasuryInventory: "0",
      circulatingSupply: "0",
    });
    try {
      const market = isolated.asset.marketState!;
      const protectedBefore = market.protectedReserve.toString();
      const stabBefore = market.stabilizationFund.toString();
      const treasuryBefore = market.treasuryInventory.toString();
      const circBefore = market.circulatingSupply.toString();

      const sameKey = `sweep-idem-${tag}`;
      const first = await sweepCryptoRevenue(actor, {
        symbol: isolated.symbol,
        amount: "4.00",
        reason: "Phase4 concurrency sweep A",
        confirmed: true,
        idempotencyKey: sameKey,
        expectedMarketStateVersion: 0,
      });
      assert.equal(first.replayed, false);
      const replay = await sweepCryptoRevenue(actor, {
        symbol: isolated.symbol,
        amount: "4.00",
        reason: "Phase4 concurrency sweep A",
        confirmed: true,
        idempotencyKey: sameKey,
        expectedMarketStateVersion: 0,
      });
      assert.equal(replay.replayed, true);
      assert.equal(replay.sweepId, first.sweepId);

      const afterFirst = await prisma.terminalCryptoMarketState.findUniqueOrThrow({
        where: { assetId: isolated.asset.id },
      });
      // Remaining accrued revenue = 6. Concurrent sweeps of 5 and 5 → only one may commit.
      const raced = await Promise.allSettled([
        sweepCryptoRevenue(actor, {
          symbol: isolated.symbol,
          amount: "5.00",
          reason: "Phase4 concurrency sweep race 1",
          confirmed: true,
          idempotencyKey: `sweep-race-a-${tag}`,
          expectedMarketStateVersion: afterFirst.version,
        }),
        sweepCryptoRevenue(actor, {
          symbol: isolated.symbol,
          amount: "5.00",
          reason: "Phase4 concurrency sweep race 2",
          confirmed: true,
          idempotencyKey: `sweep-race-b-${tag}`,
          expectedMarketStateVersion: afterFirst.version,
        }),
      ]);
      const ok = raced.filter((r) => r.status === "fulfilled");
      const fail = raced.filter((r) => r.status === "rejected");
      assert.equal(ok.length, 1);
      assert.equal(fail.length, 1);
      const failCode = (fail[0] as PromiseRejectedResult).reason?.code;
      assert.ok(
        failCode === "INSUFFICIENT_REVENUE" || failCode === "VERSION_CONFLICT",
        `expected INSUFFICIENT_REVENUE or VERSION_CONFLICT, got ${failCode}`,
      );

      const finalMarket = await prisma.terminalCryptoMarketState.findUniqueOrThrow({
        where: { assetId: isolated.asset.id },
      });
      assert.equal(finalMarket.protectedReserve.toString(), protectedBefore);
      assert.equal(finalMarket.stabilizationFund.toString(), stabBefore);
      assert.equal(finalMarket.treasuryInventory.toString(), treasuryBefore);
      assert.equal(finalMarket.circulatingSupply.toString(), circBefore);
      assert.ok(finalMarket.accruedRevenue.greaterThanOrEqualTo(0));
      assert.ok(finalMarket.accruedRevenue.lessThanOrEqualTo("6"));

      const sweeps = await prisma.terminalCryptoRevenueSweep.findMany({
        where: { assetId: isolated.asset.id },
      });
      assert.equal(sweeps.length, 2); // idempotent first + one race winner
      const sweptTotal = sweeps.reduce((sum, s) => sum.plus(s.amount), (await import("./crypto-decimal")).d("0"));
      assert.equal(sweptTotal.toFixed(2), "9.00");

      const cash = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
        where: { portfolioId: dest.portfolio.id },
      });
      assert.equal(cash.availableCash.toFixed(2), "9.00");
      const cashCredits = await prisma.terminalCashLedgerEntry.count({
        where: {
          portfolioId: dest.portfolio.id,
          source: "terminal_crypto_revenue_sweep",
        },
      });
      assert.equal(cashCredits, 2);
      const marketLedger = await prisma.terminalCryptoMarketLedgerEntry.count({
        where: { assetId: isolated.asset.id, kind: "REVENUE_SWEEP" },
      });
      assert.equal(marketLedger, 2);
    } finally {
      if (prevDest === undefined) delete process.env.TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID;
      else process.env.TERMINAL_CRYPTO_REVENUE_PORTFOLIO_ID = prevDest;
      await isolated.cleanup();
    }
  });

  it("lifecycle transition races honor expectedVersion", async (t) => {
    if (!phase4Ready) {
      t.skip(phase4SkipReason);
      return;
    }
    const tag = suffix();
    const actor = await createCorpActor(tag);
    const isolated = await createIsolatedAsset({ tag, status: "ACTIVE" });
    try {
      const raced = await Promise.allSettled([
        transitionCryptoAssetStatus(actor, {
          symbol: isolated.symbol,
          toStatus: "HALTED",
          expectedStatus: "ACTIVE",
          expectedVersion: 0,
          reason: "Phase4 lifecycle race halt A",
          confirmed: true,
          idempotencyKey: `life-a-${tag}`,
        }),
        transitionCryptoAssetStatus(actor, {
          symbol: isolated.symbol,
          toStatus: "REDEMPTION_ONLY",
          expectedStatus: "ACTIVE",
          expectedVersion: 0,
          reason: "Phase4 lifecycle race redemption B",
          confirmed: true,
          idempotencyKey: `life-b-${tag}`,
        }),
      ]);
      const ok = raced.filter((r) => r.status === "fulfilled");
      const fail = raced.filter((r) => r.status === "rejected");
      assert.equal(ok.length, 1);
      assert.equal(fail.length, 1);
      assert.equal((fail[0] as PromiseRejectedResult).reason?.code, "VERSION_CONFLICT");

      const asset = await prisma.terminalCryptoAsset.findUniqueOrThrow({
        where: { id: isolated.asset.id },
      });
      assert.ok(asset.status === "HALTED" || asset.status === "REDEMPTION_ONLY");
      assert.equal(asset.version, 1);
      const changes = await prisma.terminalCryptoAssetStatusChange.count({
        where: { assetId: isolated.asset.id },
      });
      assert.equal(changes, 1);
    } finally {
      await isolated.cleanup();
    }
  });

  it("reconciliation during concurrent trading stays read-only and finishes healthy", async (t) => {
    if (!phase4Ready) {
      t.skip(phase4SkipReason);
      return;
    }
    const tag = suffix();
    const traderUser = await prisma.user.create({
      data: {
        discordId: `discord-recontrade-${tag}`,
        discordUsername: `recontrade_${tag}`,
        minecraftUsername: `recontrade_${tag}`,
        eligibilityConfirmedAt: new Date(),
        coreOnboardingCompletedAt: new Date(),
        onboardingCompletedAt: new Date(),
      },
    });
    const portfolio = await prisma.terminalPortfolio.create({
      data: {
        name: `Recon Trade ${tag}`,
        ownerType: "PERSONAL",
        ownerUserId: traderUser.id,
        createdByUserId: traderUser.id,
        status: "ACTIVE",
        isDefault: true,
      },
    });
    await prisma.terminalPortfolioCashAccount.create({
      data: {
        portfolioId: portfolio.id,
        availableCash: "10000",
        reservedCash: 0,
        currency: "FLORIN",
        version: 0,
      },
    });
    const altaUser = await loadAltaUserOrThrow(traderUser.id);

    const snap = await prisma.terminalCryptoAsset.findUniqueOrThrow({
      where: { symbol: "NPFC" },
      include: { marketState: true },
    });
    assert.ok(snap.marketState);
    // Force a pristine NPFC baseline so prior concurrency residue cannot poison assertions.
    await prisma.terminalCryptoWalletLedgerEntry.deleteMany({ where: { assetId: snap.id } });
    await prisma.terminalCryptoWalletBalance.deleteMany({ where: { assetId: snap.id } });
    await prisma.terminalCryptoMarketLedgerEntry.deleteMany({ where: { assetId: snap.id } });
    await prisma.terminalCryptoPriceCandle.deleteMany({ where: { assetId: snap.id } });
    await prisma.terminalCryptoReconciliationIssue.deleteMany({ where: { assetId: snap.id } });
    const staleSettlements = await prisma.terminalCryptoOrderSettlement.findMany({
      where: { assetId: snap.id },
      select: { id: true, orderId: true },
    });
    if (staleSettlements.length > 0) {
      const staleOrderIds = staleSettlements.map((s) => s.orderId);
      await prisma.terminalCryptoMarketLedgerEntry.deleteMany({
        where: { settlementId: { in: staleSettlements.map((s) => s.id) } },
      });
      await prisma.terminalCryptoOrderSettlement.deleteMany({ where: { assetId: snap.id } });
      await prisma.terminalOrderFill.deleteMany({ where: { orderId: { in: staleOrderIds } } });
      await prisma.terminalPortfolioActivity.deleteMany({
        where: { orderId: { in: staleOrderIds } },
      });
      await prisma.terminalCashLedgerEntry.deleteMany({
        where: { relatedOrderId: { in: staleOrderIds } },
      });
      await prisma.terminalOrder.deleteMany({ where: { id: { in: staleOrderIds } } });
    }
    await prisma.terminalCryptoMarketState.update({
      where: { assetId: snap.id },
      data: {
        treasuryInventory: "0",
        circulatingSupply: "0",
        protectedReserve: "0",
        stabilizationFund: "0",
        accruedRevenue: "0",
        currentMarginalPrice: "1",
        version: 0,
      },
    });
    await prisma.terminalCryptoAsset.update({
      where: { symbol: "NPFC" },
      data: { status: "ACTIVE", version: 0 },
    });

    try {
      const preview = await previewTerminalCryptoOrder(altaUser, {
        portfolioId: portfolio.id,
        symbol: "NPFC",
        side: "BUY",
        grossFlorins: "25",
      });

      // Hold market row lock while reconciliation begins, then complete the trade.
      let releaseHold!: () => void;
      const hold = new Promise<void>((resolve) => {
        releaseHold = resolve;
      });
      let lockHeld!: () => void;
      const locked = new Promise<void>((resolve) => {
        lockHeld = resolve;
      });

      const lockTxn = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "TerminalCryptoMarketState" WHERE "assetId" = ${snap.id} FOR UPDATE`;
          lockHeld();
          await hold;
        },
        { timeout: 60_000, maxWait: 60_000 },
      );

      await locked;
      const reconDuringHold = runCryptoReconciliation({
        source: "manual",
        assetSymbols: ["NPFC"],
      });
      // Allow recon to attempt reads while the trade lock is held.
      await new Promise((r) => setTimeout(r, 100));
      releaseHold();
      await lockTxn;

      const [tradeResult, reconDuring] = await Promise.all([
        submitTerminalCryptoOrder(altaUser, {
          portfolioId: portfolio.id,
          symbol: "NPFC",
          side: "BUY",
          grossFlorins: "25",
          clientKey: `ck-recontrade-${tag}`,
          expectedMarketStateVersion: preview.marketStateVersion,
          quoteExpiresAt: preview.quoteExpiresAt,
          quoteFingerprint: preview.quoteFingerprint,
        }),
        reconDuringHold,
      ]);

      assert.equal(tradeResult.ok, true);
      assert.ok(reconDuring.status === "SUCCEEDED" || reconDuring.status === "PARTIAL");
      // Must not invent a critical from a torn in-flight trade while state was locked / atomic.
      const falseCriticals = await prisma.terminalCryptoReconciliationIssue.count({
        where: {
          status: "OPEN",
          severity: "CRITICAL",
          assetId: snap.id,
          summary: { contains: "half" },
        },
      });
      assert.equal(falseCriticals, 0);

      // Restore NPFC to the pre-test snapshot, then prove a healthy post-flight recon.
      const orders = await prisma.terminalOrder.findMany({
        where: { portfolioId: portfolio.id },
        select: { id: true },
      });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await prisma.terminalCryptoMarketLedgerEntry.deleteMany({
          where: { settlement: { orderId: { in: orderIds } } },
        });
        await prisma.terminalCryptoOrderSettlement.deleteMany({
          where: { orderId: { in: orderIds } },
        });
        await prisma.terminalOrderFill.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.terminalPortfolioActivity.deleteMany({ where: { orderId: { in: orderIds } } });
        await prisma.terminalCashLedgerEntry.deleteMany({
          where: { relatedOrderId: { in: orderIds } },
        });
        await prisma.terminalOrder.deleteMany({ where: { id: { in: orderIds } } });
      }
      const wallets = await prisma.terminalCryptoWallet.findMany({
        where: { portfolioId: portfolio.id },
        select: { id: true },
      });
      const walletIds = wallets.map((w) => w.id);
      if (walletIds.length > 0) {
        await prisma.terminalCryptoWalletLedgerEntry.deleteMany({
          where: { walletId: { in: walletIds } },
        });
        await prisma.terminalCryptoWalletBalance.deleteMany({
          where: { walletId: { in: walletIds } },
        });
        await prisma.terminalCryptoWallet.deleteMany({ where: { id: { in: walletIds } } });
      }
      await prisma.terminalCryptoWalletLedgerEntry.deleteMany({ where: { assetId: snap.id } });
      await prisma.terminalCryptoWalletBalance.deleteMany({ where: { assetId: snap.id } });
      await prisma.terminalCryptoMarketLedgerEntry.deleteMany({ where: { assetId: snap.id } });
      await prisma.terminalCryptoPriceCandle.deleteMany({ where: { assetId: snap.id } });
      await prisma.terminalCryptoReconciliationIssue.deleteMany({ where: { assetId: snap.id } });
      await prisma.terminalCryptoMarketState.update({
        where: { assetId: snap.id },
        data: {
          treasuryInventory: "0",
          circulatingSupply: "0",
          protectedReserve: "0",
          stabilizationFund: "0",
          accruedRevenue: "0",
          currentMarginalPrice: "1",
          version: 0,
        },
      });
      await prisma.terminalCryptoAsset.update({
        where: { symbol: "NPFC" },
        data: { status: "ACTIVE", version: 0 },
      });

      const reconAfter = await runCryptoReconciliation({
        source: "manual",
        assetSymbols: ["NPFC"],
      });
      const npfcOpenCritical = await prisma.terminalCryptoReconciliationIssue.findMany({
        where: { assetId: snap.id, status: "OPEN", severity: "CRITICAL" },
      });
      assert.equal(
        npfcOpenCritical.length,
        0,
        `NPFC criticals after restore: ${npfcOpenCritical.map((i) => `${i.checkKey}:${i.summary}`).join(" | ")}`,
      );
      assert.ok(
        reconAfter.status === "SUCCEEDED" || reconAfter.status === "PARTIAL",
        `unexpected recon status ${reconAfter.status}`,
      );
    } finally {
      await prisma.terminalCryptoAsset.update({
        where: { symbol: "NPFC" },
        data: { status: "DRAFT", version: snap.version },
      });
      await prisma.terminalCryptoMarketState.update({
        where: { assetId: snap.id },
        data: {
          treasuryInventory: "0",
          circulatingSupply: "0",
          protectedReserve: "0",
          stabilizationFund: "0",
          accruedRevenue: "0",
          currentMarginalPrice: "1",
          version: 0,
        },
      });
      await prisma.financialIdempotencyRecord.deleteMany({
        where: {
          scope: "terminal_crypto_order",
          idempotencyKey: { startsWith: `${portfolio.id}:` },
        },
      });
    }
  });

  it("unique unresolved reconciliation fingerprints under concurrency", async (t) => {
    if (!phase4Ready) {
      t.skip(phase4SkipReason);
      return;
    }
    const tag = suffix();
    // Intentionally undercollateralize a STABLE fixture for a deterministic critical fingerprint.
    const isolated = await createIsolatedAsset({
      tag,
      status: "ACTIVE",
      circulatingSupply: "100",
      protectedReserve: "1",
      undercollateralized: true,
    });
    try {
      const [runA, runB] = await Promise.all([
        runCryptoReconciliation({ source: "manual", assetSymbols: [isolated.symbol] }),
        runCryptoReconciliation({ source: "manual", assetSymbols: [isolated.symbol] }),
      ]);
      assert.ok(runA.runId !== runB.runId);

      const fp = fingerprintIssue({
        checkKey: "npfc_backing",
        assetId: isolated.asset.id,
      });
      const openIssues = await prisma.terminalCryptoReconciliationIssue.findMany({
        where: {
          assetId: isolated.asset.id,
          fingerprint: fp,
          status: "OPEN",
        },
      });
      assert.equal(openIssues.length, 1, "exactly one unresolved fingerprint");

      await prisma.terminalCryptoReconciliationIssue.update({
        where: { id: openIssues[0]!.id },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByRunId: runA.runId },
      });

      // Recurring mismatch after resolve may open a new issue with the same fingerprint.
      const runC = await runCryptoReconciliation({
        source: "manual",
        assetSymbols: [isolated.symbol],
      });
      assert.ok(runC.newIssueCount >= 1);
      const openAfter = await prisma.terminalCryptoReconciliationIssue.findMany({
        where: {
          assetId: isolated.asset.id,
          fingerprint: fp,
          status: "OPEN",
        },
      });
      assert.equal(openAfter.length, 1);
      assert.notEqual(openAfter[0]!.id, openIssues[0]!.id);

      // A different check remains distinct.
      const otherFp = fingerprintIssue({
        checkKey: "current_price",
        assetId: isolated.asset.id,
      });
      assert.notEqual(fp, otherFp);
    } finally {
      await isolated.cleanup();
    }
  });
});
