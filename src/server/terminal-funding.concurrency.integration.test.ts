/**
 * Database-backed Terminal funding concurrency / idempotency tests.
 *
 * Requires DATABASE_URL and migration `20260730200000_terminal_funding_transfers`.
 *
 *   npx tsx --test src/server/terminal-funding.concurrency.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before } from "node:test";

function loadDotEnvDatabaseUrl(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return;
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
    if (value) process.env.DATABASE_URL = value;
    break;
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

describe("terminal funding concurrency (database)", { skip: skipSuite }, () => {
  let prisma: typeof import("@/server/db").prisma;
  let loadAltaUserOrThrow: typeof import("@/server/bank-account-access.service").loadAltaUserOrThrow;
  let submitTerminalFundingTransfer: typeof import("@/server/terminal-funding.service").submitTerminalFundingTransfer;
  let tableReady = false;

  before(async () => {
    const refreshHooks = await import("@/server/relationship-refresh-hooks.service");
    refreshHooks.disableRelationshipBackgroundRefresh();

    const db = await import("@/server/db");
    prisma = db.prisma;

    try {
      await prisma.$queryRaw`SELECT 1 FROM "TerminalFundingTransfer" LIMIT 1`;
      tableReady = true;
    } catch {
      tableReady = false;
      return;
    }

    const access = await import("@/server/bank-account-access.service");
    loadAltaUserOrThrow = access.loadAltaUserOrThrow;
    const funding = await import("@/server/terminal-funding.service");
    submitTerminalFundingTransfer = funding.submitTerminalFundingTransfer;
  });

  async function createFixture(opts?: { bankBalance?: number; terminalCash?: number }) {
    const tag = suffix();
    const user = await prisma.user.create({
      data: {
        discordId: `discord-tfd-${tag}`,
        discordUsername: `tfd_${tag}`,
        minecraftUsername: `tfd_${tag}`,
    minecraftUuid: null,
    minecraftVerifiedAt: null,
    eligibilityConfirmedAt: null,
    coreOnboardingCompletedAt: null,
    onboardingCompletedAt: null,
      },
    });
    const account = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        ownershipType: "PERSONAL",
        accountType: "CHECKING",
        accountName: "Funding Test Checking",
        accountNumber: `AB-2000-${tag.toUpperCase()}`,
        status: "ACTIVE",
        balance: opts?.bankBalance ?? 1_000,
        currency: "FLR",
      },
    });
    const portfolio = await prisma.terminalPortfolio.create({
      data: {
        name: `Funding Book ${tag}`,
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
        availableCash: opts?.terminalCash ?? 500,
        reservedCash: 0,
        currency: "FLORIN",
      },
    });
    const altaUser = await loadAltaUserOrThrow(user.id);
    return { user, account, portfolio, altaUser, tag };
  }

  async function cleanup(fixture: Awaited<ReturnType<typeof createFixture>>) {
    const funding = await prisma.terminalFundingTransfer.findMany({
      where: { bankAccountId: fixture.account.id },
      select: { transferGroupId: true },
    });
    await prisma.terminalFundingTransfer.deleteMany({
      where: { bankAccountId: fixture.account.id },
    });
    await prisma.bankTransaction.deleteMany({ where: { bankAccountId: fixture.account.id } });
    const groupIds = funding
      .map((row) => row.transferGroupId)
      .filter((id): id is string => Boolean(id));
    if (groupIds.length > 0) {
      await prisma.transferGroup.deleteMany({ where: { id: { in: groupIds } } });
    }
    await prisma.terminalPortfolioActivity.deleteMany({
      where: { portfolioId: fixture.portfolio.id },
    });
    await prisma.terminalCashLedgerEntry.deleteMany({
      where: { portfolioId: fixture.portfolio.id },
    });
    await prisma.terminalPortfolioCashAccount.deleteMany({
      where: { portfolioId: fixture.portfolio.id },
    });
    await prisma.terminalPortfolio.delete({ where: { id: fixture.portfolio.id } });
    await prisma.bankAccount.delete({ where: { id: fixture.account.id } });
    await prisma.financialIdempotencyRecord
      .deleteMany({ where: { userId: fixture.user.id } })
      .catch(() => undefined);
    await prisma.user.delete({ where: { id: fixture.user.id } });
  }

  it("moves Bank → Terminal and Terminal → Bank with exact balances", async (t) => {
    if (!tableReady) {
      t.skip("TerminalFundingTransfer table missing — apply migration first");
      return;
    }
    const fixture = await createFixture({ bankBalance: 1_000, terminalCash: 200 });
    t.after(() => cleanup(fixture));

    const toTerminal = await submitTerminalFundingTransfer(fixture.altaUser, {
      direction: "BANK_TO_TERMINAL",
      bankAccountId: fixture.account.id,
      portfolioId: fixture.portfolio.id,
      amount: 150.5,
      idempotencyKey: `tfd-b2t-${fixture.tag}`,
    });
    assert.equal(toTerminal.status, "COMPLETED");
    assert.equal(toTerminal.amount, 150.5);

    const bankAfter = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: fixture.account.id },
    });
    const cashAfter = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
      where: { portfolioId: fixture.portfolio.id },
    });
    assert.equal(Number(bankAfter.balance), 849.5);
    assert.equal(Number(cashAfter.availableCash), 350.5);

    const toBank = await submitTerminalFundingTransfer(fixture.altaUser, {
      direction: "TERMINAL_TO_BANK",
      bankAccountId: fixture.account.id,
      portfolioId: fixture.portfolio.id,
      amount: 50,
      idempotencyKey: `tfd-t2b-${fixture.tag}`,
    });
    assert.equal(toBank.status, "COMPLETED");

    const bankFinal = await prisma.bankAccount.findUniqueOrThrow({
      where: { id: fixture.account.id },
    });
    const cashFinal = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
      where: { portfolioId: fixture.portfolio.id },
    });
    assert.equal(Number(bankFinal.balance), 899.5);
    assert.equal(Number(cashFinal.availableCash), 300.5);

    const activityCount = await prisma.terminalPortfolioActivity.count({
      where: { portfolioId: fixture.portfolio.id },
    });
    const ledgerCount = await prisma.terminalCashLedgerEntry.count({
      where: { portfolioId: fixture.portfolio.id },
    });
    assert.equal(activityCount, 2);
    assert.equal(ledgerCount, 2);
  });

  it("replays the same idempotency key without double-moving money", async (t) => {
    if (!tableReady) {
      t.skip("TerminalFundingTransfer table missing — apply migration first");
      return;
    }
    const fixture = await createFixture({ bankBalance: 500, terminalCash: 0 });
    t.after(() => cleanup(fixture));
    const key = `tfd-idem-${fixture.tag}`;
    const first = await submitTerminalFundingTransfer(fixture.altaUser, {
      direction: "BANK_TO_TERMINAL",
      bankAccountId: fixture.account.id,
      portfolioId: fixture.portfolio.id,
      amount: 100,
      idempotencyKey: key,
    });
    const second = await submitTerminalFundingTransfer(fixture.altaUser, {
      direction: "BANK_TO_TERMINAL",
      bankAccountId: fixture.account.id,
      portfolioId: fixture.portfolio.id,
      amount: 100,
      idempotencyKey: key,
    });
    assert.equal(first.id, second.id);
    assert.equal(first.referenceCode, second.referenceCode);

    const bank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: fixture.account.id } });
    const transfers = await prisma.terminalFundingTransfer.count({
      where: { bankAccountId: fixture.account.id },
    });
    assert.equal(Number(bank.balance), 400);
    assert.equal(transfers, 1);
  });

  it("prevents concurrent double-spend of Bank available balance", async (t) => {
    if (!tableReady) {
      t.skip("TerminalFundingTransfer table missing — apply migration first");
      return;
    }
    const fixture = await createFixture({ bankBalance: 100, terminalCash: 0 });
    t.after(() => cleanup(fixture));

    const results = await Promise.allSettled([
      submitTerminalFundingTransfer(fixture.altaUser, {
        direction: "BANK_TO_TERMINAL",
        bankAccountId: fixture.account.id,
        portfolioId: fixture.portfolio.id,
        amount: 80,
        idempotencyKey: `tfd-race-a-${fixture.tag}`,
      }),
      submitTerminalFundingTransfer(fixture.altaUser, {
        direction: "BANK_TO_TERMINAL",
        bankAccountId: fixture.account.id,
        portfolioId: fixture.portfolio.id,
        amount: 80,
        idempotencyKey: `tfd-race-b-${fixture.tag}`,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const bank = await prisma.bankAccount.findUniqueOrThrow({ where: { id: fixture.account.id } });
    const cash = await prisma.terminalPortfolioCashAccount.findUniqueOrThrow({
      where: { portfolioId: fixture.portfolio.id },
    });
    assert.equal(Number(bank.balance), 20);
    assert.equal(Number(cash.availableCash), 80);
    assert.equal(
      await prisma.terminalFundingTransfer.count({ where: { bankAccountId: fixture.account.id } }),
      1,
    );
  });
});
