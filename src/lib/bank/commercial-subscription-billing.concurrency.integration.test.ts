/**
 * Database-backed concurrency tests for Commercial Pro purchase and renewal.
 *
 * Requires DATABASE_URL and migration
 * `20260726010000_commercial_subscription_charge_ledger` applied.
 *
 *   npx tsx --test src/lib/bank/commercial-subscription-billing.concurrency.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, before } from "node:test";

function loadDotEnvDatabaseUrl(): void {
  if (process.env.DATABASE_URL?.trim()) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
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

// Must run before any Prisma client import.
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

type BillingFixture = {
  userId: string;
  companyId: string;
  accountId: string;
  membershipId: string;
};

const skipSuite = !hasDatabaseUrl();

describe(
  "commercial subscription billing concurrency (database)",
  { skip: skipSuite },
  () => {
    let prisma: typeof import("@/server/db").prisma;
    let loadAltaUserOrThrow: typeof import("@/server/bank-account-access.service").loadAltaUserOrThrow;
    let purchaseCommercialPro: typeof import("@/server/commercial-billing.service").purchaseCommercialPro;
    let renewCommercialProSubscription: typeof import("@/server/commercial-billing.service").renewCommercialProSubscription;
    let addBillingMonths: typeof import("@/server/commercial-billing.service").addBillingMonths;
    let clearCommercialPlatformSettingsCache: typeof import("@/server/commercial-platform-settings.service").clearCommercialPlatformSettingsCache;
    let enableTestNotificationTransport: typeof import("@/server/notification-test-transport").enableTestNotificationTransport;
    let clearRecordedNotificationMessages: typeof import("@/server/notification-test-transport").clearRecordedNotificationMessages;
    let getRecordedNotificationMessages: typeof import("@/server/notification-test-transport").getRecordedNotificationMessages;
    let proMonthlyFee: number;
    let ledgerReady = false;

    before(async () => {
      const notificationTransport = await import("@/server/notification-test-transport");
      enableTestNotificationTransport = notificationTransport.enableTestNotificationTransport;
      clearRecordedNotificationMessages = notificationTransport.clearRecordedNotificationMessages;
      getRecordedNotificationMessages = notificationTransport.getRecordedNotificationMessages;
      enableTestNotificationTransport();

      const refreshHooks = await import("@/server/relationship-refresh-hooks.service");
      refreshHooks.disableRelationshipBackgroundRefresh();

      const db = await import("@/server/db");
      prisma = db.prisma;

      const access = await import("@/server/bank-account-access.service");
      loadAltaUserOrThrow = access.loadAltaUserOrThrow;

      const billing = await import("@/server/commercial-billing.service");
      purchaseCommercialPro = billing.purchaseCommercialPro;
      renewCommercialProSubscription = billing.renewCommercialProSubscription;
      addBillingMonths = billing.addBillingMonths;

      const settings = await import("@/server/commercial-platform-settings.service");
      clearCommercialPlatformSettingsCache = settings.clearCommercialPlatformSettingsCache;

      const defaults = await import("@/lib/platform/commercial-plan-settings-types");
      proMonthlyFee = defaults.DEFAULT_COMMERCIAL_PLATFORM_SETTINGS.proMonthlyFee;

      try {
        await prisma.commercialSubscriptionCharge.findFirst({ take: 1 });
        ledgerReady = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (
          message.includes("CommercialSubscriptionCharge") ||
          message.includes("does not exist") ||
          message.includes("P2021")
        ) {
          ledgerReady = false;
          console.warn(
            "[skip-ready] CommercialSubscriptionCharge missing — apply migration 20260726010000_commercial_subscription_charge_ledger.",
          );
        } else {
          throw error;
        }
      }
    });

    async function createBillingFixture(options?: {
      balance?: number;
    }): Promise<BillingFixture> {
      const id = suffix();
      const balance = options?.balance ?? 500_000;

      const user = await prisma.user.create({
        data: {
          discordId: `test-billing-${id}`,
          discordUsername: `billing_${id}`,
          accountStatus: "ACTIVE",
        },
      });

      const company = await prisma.company.create({
        data: {
          name: `Billing Concurrency Co ${id}`,
          type: "PRIVATE_COMPANY",
          status: "ACTIVE",
          verificationStatus: "VERIFIED",
          commercialPlan: "CORE",
          planStatus: "ACTIVE",
          billingStatus: "NOT_BILLED",
        },
      });

      const membership = await prisma.companyMembership.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: "OWNER",
        },
      });

      const account = await prisma.bankAccount.create({
        data: {
          userId: user.id,
          companyId: company.id,
          ownershipType: "COMPANY",
          accountType: "BUSINESS_OPERATING",
          accountName: `Operating ${id}`,
          accountNumber: `TB${id.toUpperCase().slice(0, 10)}`,
          status: "ACTIVE",
          balance,
        },
      });

      return {
        userId: user.id,
        companyId: company.id,
        accountId: account.id,
        membershipId: membership.id,
      };
    }

    async function cleanupBillingFixture(fixture: BillingFixture): Promise<void> {
      await prisma.commercialSubscriptionCharge.deleteMany({
        where: { companyId: fixture.companyId },
      });
      await prisma.bankTransaction.deleteMany({
        where: { bankAccountId: fixture.accountId },
      });
      await prisma.company.updateMany({
        where: { id: fixture.companyId },
        data: { commercialBillingAccountId: null },
      });
      await prisma.bankAccount.deleteMany({ where: { id: fixture.accountId } });
      await prisma.companyMembership.deleteMany({ where: { id: fixture.membershipId } });
      await prisma.company.deleteMany({ where: { id: fixture.companyId } });
      await prisma.user.deleteMany({ where: { id: fixture.userId } });
    }

    it("runs concurrent initial purchases without double charging", async (t) => {
      if (!ledgerReady) {
        t.skip(
          "CommercialSubscriptionCharge table missing — apply migration 20260726010000 first",
        );
        return;
      }

      clearCommercialPlatformSettingsCache();
      clearRecordedNotificationMessages();
      enableTestNotificationTransport();

      const fixture = await createBillingFixture();
      const user = await loadAltaUserOrThrow(fixture.userId);

      try {
        const startingBalance = Number(
          (
            await prisma.bankAccount.findUniqueOrThrow({
              where: { id: fixture.accountId },
              select: { balance: true },
            })
          ).balance.toString(),
        );

        const results = await Promise.allSettled([
          purchaseCommercialPro(
            user,
            { companyId: fixture.companyId, billingAccountId: fixture.accountId },
            "concurrency-test",
          ),
          purchaseCommercialPro(
            user,
            { companyId: fixture.companyId, billingAccountId: fixture.accountId },
            "concurrency-test",
          ),
        ]);

        const fulfilled = results.filter(
          (row): row is PromiseFulfilledResult<Awaited<ReturnType<typeof purchaseCommercialPro>>> =>
            row.status === "fulfilled",
        );
        const rejected = results.filter((row) => row.status === "rejected");

        assert.ok(fulfilled.length >= 1, "at least one purchase must succeed");
        for (const row of rejected) {
          const reason = row.status === "rejected" ? row.reason : null;
          const message = reason instanceof Error ? reason.message : String(reason);
          assert.match(
            message,
            /already on Alta Commercial Pro|UNIQUE|unique constraint/i,
            `unexpected rejection: ${message}`,
          );
        }

        assert.equal(
          new Set(fulfilled.map((row) => row.value.referenceCode)).size,
          1,
          "callers must reconcile to one reference",
        );
        assert.equal(
          new Set(fulfilled.map((row) => row.value.transactionId)).size,
          1,
          "callers must reconcile to one bank transaction",
        );

        const charges = await prisma.commercialSubscriptionCharge.findMany({
          where: { companyId: fixture.companyId, chargeType: "INITIAL_PURCHASE" },
        });
        assert.equal(charges.length, 1);
        assert.equal(charges[0]!.status, "SUCCEEDED");

        const bankTxns = await prisma.bankTransaction.findMany({
          where: {
            bankAccountId: fixture.accountId,
            description: { contains: "Commercial Pro · First month" },
            status: "APPROVED",
          },
        });
        assert.equal(bankTxns.length, 1);
        assert.equal(Number(bankTxns[0]!.amount.toString()), proMonthlyFee);

        const company = await prisma.company.findUniqueOrThrow({
          where: { id: fixture.companyId },
        });
        assert.equal(company.commercialPlan, "PRO");
        assert.equal(company.billingStatus, "CURRENT");
        assert.equal(company.commercialBillingAccountId, fixture.accountId);
        assert.ok(company.commercialBillingCycleId);
        assert.ok(company.commercialNextBillingAt);

        const endingBalance = Number(
          (
            await prisma.bankAccount.findUniqueOrThrow({
              where: { id: fixture.accountId },
              select: { balance: true },
            })
          ).balance.toString(),
        );
        assert.equal(endingBalance, startingBalance - proMonthlyFee);

        assert.ok(Array.isArray(getRecordedNotificationMessages()));
      } finally {
        await cleanupBillingFixture(fixture);
      }
    });

    it("runs concurrent renewals without double charging or double advancing next billing date", async (t) => {
      if (!ledgerReady) {
        t.skip(
          "CommercialSubscriptionCharge table missing — apply migration 20260726010000 first",
        );
        return;
      }

      clearCommercialPlatformSettingsCache();
      clearRecordedNotificationMessages();
      enableTestNotificationTransport();

      const fixture = await createBillingFixture();
      const user = await loadAltaUserOrThrow(fixture.userId);
      const dueAt = new Date("2026-07-26T12:00:00.000Z");
      const expectedNext = addBillingMonths(dueAt, 1);

      try {
        await purchaseCommercialPro(
          user,
          { companyId: fixture.companyId, billingAccountId: fixture.accountId },
          "concurrency-test-seed",
        );

        await prisma.company.update({
          where: { id: fixture.companyId },
          data: {
            commercialNextBillingAt: dueAt,
            commercialMonthlyFee: proMonthlyFee,
          },
        });

        const startingBalance = Number(
          (
            await prisma.bankAccount.findUniqueOrThrow({
              where: { id: fixture.accountId },
              select: { balance: true },
            })
          ).balance.toString(),
        );

        const results = await Promise.allSettled([
          renewCommercialProSubscription({ companyId: fixture.companyId, now: dueAt }),
          renewCommercialProSubscription({ companyId: fixture.companyId, now: dueAt }),
        ]);

        const fulfilled = results.filter(
          (
            row,
          ): row is PromiseFulfilledResult<
            Awaited<ReturnType<typeof renewCommercialProSubscription>>
          > => row.status === "fulfilled",
        );
        assert.equal(fulfilled.length, 2, "both renewals should settle without throwing");

        assert.equal(
          new Set(fulfilled.map((row) => row.value.referenceCode)).size,
          1,
          "renewals must share one reference",
        );
        assert.equal(
          new Set(fulfilled.map((row) => row.value.transactionId)).size,
          1,
          "renewals must share one bank transaction",
        );

        for (const row of fulfilled) {
          assert.equal(row.value.nextBillingAt.toISOString(), expectedNext.toISOString());
        }

        const renewals = await prisma.commercialSubscriptionCharge.findMany({
          where: { companyId: fixture.companyId, chargeType: "MONTHLY_RENEWAL" },
        });
        assert.equal(renewals.length, 1);
        assert.equal(renewals[0]!.status, "SUCCEEDED");

        const renewalTxns = await prisma.bankTransaction.findMany({
          where: {
            bankAccountId: fixture.accountId,
            description: { contains: "Commercial Pro · Monthly subscription" },
            status: "APPROVED",
          },
        });
        assert.equal(renewalTxns.length, 1);

        const company = await prisma.company.findUniqueOrThrow({
          where: { id: fixture.companyId },
        });
        assert.equal(company.commercialPlan, "PRO");
        assert.equal(company.billingStatus, "CURRENT");
        assert.equal(company.commercialNextBillingAt?.toISOString(), expectedNext.toISOString());

        const endingBalance = Number(
          (
            await prisma.bankAccount.findUniqueOrThrow({
              where: { id: fixture.accountId },
              select: { balance: true },
            })
          ).balance.toString(),
        );
        assert.equal(endingBalance, startingBalance - proMonthlyFee);
      } finally {
        await cleanupBillingFixture(fixture);
      }
    });

    it("rolls back failed purchases without leaving debit or charge ledger residue", async (t) => {
      if (!ledgerReady) {
        t.skip(
          "CommercialSubscriptionCharge table missing — apply migration 20260726010000 first",
        );
        return;
      }

      clearCommercialPlatformSettingsCache();
      enableTestNotificationTransport();

      const fixture = await createBillingFixture({ balance: 1 });
      const user = await loadAltaUserOrThrow(fixture.userId);

      try {
        await assert.rejects(
          () =>
            purchaseCommercialPro(
              user,
              { companyId: fixture.companyId, billingAccountId: fixture.accountId },
              "concurrency-test-fail",
            ),
          /Insufficient funds|available balance/i,
        );

        const company = await prisma.company.findUniqueOrThrow({
          where: { id: fixture.companyId },
        });
        assert.equal(company.commercialPlan, "CORE");
        assert.equal(company.billingStatus, "NOT_BILLED");
        assert.equal(company.commercialBillingCycleId, null);
        assert.equal(company.commercialNextBillingAt, null);

        const charges = await prisma.commercialSubscriptionCharge.findMany({
          where: { companyId: fixture.companyId },
        });
        assert.equal(charges.length, 0);

        const bankTxns = await prisma.bankTransaction.findMany({
          where: { bankAccountId: fixture.accountId },
        });
        assert.equal(bankTxns.length, 0);

        const balance = Number(
          (
            await prisma.bankAccount.findUniqueOrThrow({
              where: { id: fixture.accountId },
              select: { balance: true },
            })
          ).balance.toString(),
        );
        assert.equal(balance, 1);
      } finally {
        await cleanupBillingFixture(fixture);
      }
    });
  },
);
