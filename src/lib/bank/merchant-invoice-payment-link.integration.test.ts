/**
 * Integration test for merchant invoices and payment links.
 * Requires DATABASE_URL pointing at a local/dev database.
 *
 * Creates uniquely named fixtures and deletes only those rows.
 *
 *   NODE_ENV=test VITEST=true STAFF_AUDIT_DISCORD_DISABLED=1 \
 *     npx tsx --test src/lib/bank/merchant-invoice-payment-link.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

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

function idempotencyKey(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

type InvPayFixture = {
  tag: string;
  merchantUserId: string;
  payerUserId: string;
  companyId: string;
  merchantAccountId: string;
  payerAccountId: string;
  merchantMembershipId: string;
  invoiceIds: string[];
  paymentLinkIds: string[];
};

const skipSuite = !hasDatabaseUrl();

describe("merchant invoice and payment link integration", { skip: skipSuite }, () => {
  let prisma: typeof import("@/server/db").prisma;
  let loadAltaUserOrThrow: typeof import("@/server/bank-account-access.service").loadAltaUserOrThrow;
  let createMerchantInvoiceDraft: typeof import("@/server/merchant-invoice.service").createMerchantInvoiceDraft;
  let getMerchantInvoiceDashboard: typeof import("@/server/merchant-invoice.service").getMerchantInvoiceDashboard;
  let getMerchantInvoiceDetail: typeof import("@/server/merchant-invoice.service").getMerchantInvoiceDetail;
  let sendMerchantInvoice: typeof import("@/server/merchant-invoice.service").sendMerchantInvoice;
  let payMerchantInvoice: typeof import("@/server/merchant-invoice-payment.service").payMerchantInvoice;
  let createPaymentLink: typeof import("@/server/payment-link.service").createPaymentLink;
  let getPaymentLinkDashboard: typeof import("@/server/payment-link.service").getPaymentLinkDashboard;
  let getPaymentLinkDetail: typeof import("@/server/payment-link.service").getPaymentLinkDetail;
  let payPaymentLink: typeof import("@/server/payment-link-payment.service").payPaymentLink;
  let listCompanyAltaPayReceived: typeof import("@/server/alta-pay.service").listCompanyAltaPayReceived;
  let enableTestNotificationTransport: typeof import("@/server/notification-test-transport").enableTestNotificationTransport;
  let disableRelationshipBackgroundRefresh: typeof import("@/server/relationship-refresh-hooks.service").disableRelationshipBackgroundRefresh;
  let enableRelationshipBackgroundRefresh: typeof import("@/server/relationship-refresh-hooks.service").enableRelationshipBackgroundRefresh;
  let drainRelationshipRefreshTasks: typeof import("@/server/relationship-refresh-hooks.service").drainRelationshipRefreshTasks;
  let getPendingRelationshipRefreshTaskCount: typeof import("@/server/relationship-refresh-hooks.service").getPendingRelationshipRefreshTaskCount;

  const liveFixtures = new Set<InvPayFixture>();

  before(async () => {
    const notificationTransport = await import("@/server/notification-test-transport");
    enableTestNotificationTransport = notificationTransport.enableTestNotificationTransport;
    enableTestNotificationTransport();

    const refreshHooks = await import("@/server/relationship-refresh-hooks.service");
    disableRelationshipBackgroundRefresh = refreshHooks.disableRelationshipBackgroundRefresh;
    enableRelationshipBackgroundRefresh = refreshHooks.enableRelationshipBackgroundRefresh;
    drainRelationshipRefreshTasks = refreshHooks.drainRelationshipRefreshTasks;
    getPendingRelationshipRefreshTaskCount = refreshHooks.getPendingRelationshipRefreshTaskCount;
    disableRelationshipBackgroundRefresh();

    const db = await import("@/server/db");
    prisma = db.prisma;

    const access = await import("@/server/bank-account-access.service");
    loadAltaUserOrThrow = access.loadAltaUserOrThrow;

    const invoices = await import("@/server/merchant-invoice.service");
    createMerchantInvoiceDraft = invoices.createMerchantInvoiceDraft;
    getMerchantInvoiceDashboard = invoices.getMerchantInvoiceDashboard;
    getMerchantInvoiceDetail = invoices.getMerchantInvoiceDetail;
    sendMerchantInvoice = invoices.sendMerchantInvoice;

    const invoicePay = await import("@/server/merchant-invoice-payment.service");
    payMerchantInvoice = invoicePay.payMerchantInvoice;

    const links = await import("@/server/payment-link.service");
    createPaymentLink = links.createPaymentLink;
    getPaymentLinkDashboard = links.getPaymentLinkDashboard;
    getPaymentLinkDetail = links.getPaymentLinkDetail;

    const linkPay = await import("@/server/payment-link-payment.service");
    payPaymentLink = linkPay.payPaymentLink;

    const altaPay = await import("@/server/alta-pay.service");
    listCompanyAltaPayReceived = altaPay.listCompanyAltaPayReceived;
  });

  after(async () => {
    await drainRelationshipRefreshTasks();
    assert.equal(
      getPendingRelationshipRefreshTaskCount(),
      0,
      "relationship refresh tasks must be drained before suite teardown",
    );
    for (const fixture of [...liveFixtures]) {
      await cleanupFixture(fixture);
      liveFixtures.delete(fixture);
    }
    enableRelationshipBackgroundRefresh();
  });

  async function createFixture(): Promise<InvPayFixture> {
    const tag = suffix();
    const merchant = await prisma.user.create({
      data: {
        discordId: `test-invpay-${tag}`,
        discordUsername: `invpay_${tag}`,
        accountStatus: "ACTIVE",
      },
    });
    const payer = await prisma.user.create({
      data: {
        discordId: `test-payer-${tag}`,
        discordUsername: `payer_${tag}`,
        accountStatus: "ACTIVE",
      },
    });
    const company = await prisma.company.create({
      data: {
        name: `InvPayLink IT ${tag}`,
        type: "PRIVATE_COMPANY",
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        commercialPlan: "PRO",
        planStatus: "ACTIVE",
        billingStatus: "CURRENT",
      },
    });
    const membership = await prisma.companyMembership.create({
      data: {
        userId: merchant.id,
        companyId: company.id,
        role: "OWNER",
      },
    });
    const merchantAccount = await prisma.bankAccount.create({
      data: {
        userId: merchant.id,
        companyId: company.id,
        ownershipType: "COMPANY",
        accountType: "BUSINESS_OPERATING",
        accountName: `InvPay Operating ${tag}`,
        accountNumber: `IP${tag.toUpperCase().slice(0, 10)}`,
        status: "ACTIVE",
        balance: 250_000,
      },
    });
    const payerAccount = await prisma.bankAccount.create({
      data: {
        userId: payer.id,
        companyId: null,
        ownershipType: "PERSONAL",
        accountType: "CHECKING",
        accountName: `Payer Checking ${tag}`,
        accountNumber: `PC${tag.toUpperCase().slice(0, 10)}`,
        status: "ACTIVE",
        balance: 100_000,
      },
    });

    const fixture: InvPayFixture = {
      tag,
      merchantUserId: merchant.id,
      payerUserId: payer.id,
      companyId: company.id,
      merchantAccountId: merchantAccount.id,
      payerAccountId: payerAccount.id,
      merchantMembershipId: membership.id,
      invoiceIds: [],
      paymentLinkIds: [],
    };
    liveFixtures.add(fixture);
    return fixture;
  }

  async function cleanupFixture(fixture: InvPayFixture): Promise<void> {
    const userIds = [fixture.merchantUserId, fixture.payerUserId];
    try {
      // Best-effort: relationship-intelligence may attach rows during payment side effects.
      try {
        await prisma.relationshipRecommendation.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.relationshipProfileSnapshot.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.relationshipProfile.deleteMany({
          where: { userId: { in: userIds } },
        });
      } catch {
        // Optional tables / schema variants.
      }

      await prisma.paymentLinkPayment.deleteMany({
        where: {
          OR: [
            { paymentLinkId: { in: fixture.paymentLinkIds } },
            { paymentLink: { merchantCompanyId: fixture.companyId } },
          ],
        },
      });
      await prisma.paymentLinkEvent.deleteMany({
        where: {
          OR: [
            { paymentLinkId: { in: fixture.paymentLinkIds } },
            { paymentLink: { merchantCompanyId: fixture.companyId } },
          ],
        },
      });
      await prisma.paymentLink.deleteMany({
        where: {
          OR: [{ id: { in: fixture.paymentLinkIds } }, { merchantCompanyId: fixture.companyId }],
        },
      });

      await prisma.merchantInvoicePayment.deleteMany({
        where: {
          OR: [
            { invoiceId: { in: fixture.invoiceIds } },
            { invoice: { merchantCompanyId: fixture.companyId } },
          ],
        },
      });
      await prisma.merchantInvoiceEvent.deleteMany({
        where: {
          OR: [
            { invoiceId: { in: fixture.invoiceIds } },
            { invoice: { merchantCompanyId: fixture.companyId } },
          ],
        },
      });
      await prisma.merchantInvoiceLineItem.deleteMany({
        where: {
          OR: [
            { invoiceId: { in: fixture.invoiceIds } },
            { invoice: { merchantCompanyId: fixture.companyId } },
          ],
        },
      });
      await prisma.merchantInvoice.deleteMany({
        where: {
          OR: [{ id: { in: fixture.invoiceIds } }, { merchantCompanyId: fixture.companyId }],
        },
      });

      await prisma.bankTransaction.deleteMany({
        where: {
          bankAccountId: { in: [fixture.merchantAccountId, fixture.payerAccountId] },
        },
      });
      try {
        await prisma.commercialSubscriptionCharge.deleteMany({
          where: { companyId: fixture.companyId },
        });
      } catch {
        // Table may be absent before migration deploy.
      }
      await prisma.company.updateMany({
        where: { id: fixture.companyId },
        data: { commercialBillingAccountId: null },
      });
      await prisma.bankAccount.deleteMany({
        where: { id: { in: [fixture.merchantAccountId, fixture.payerAccountId] } },
      });
      await prisma.companyMembership.deleteMany({ where: { id: fixture.merchantMembershipId } });
      await prisma.company.deleteMany({ where: { id: fixture.companyId } });
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
    } catch (error) {
      console.warn("[cleanupFixture] failed", fixture.tag, error);
    }
  }

  async function withFixture<T>(run: (fixture: InvPayFixture) => Promise<T>): Promise<T> {
    enableTestNotificationTransport();
    disableRelationshipBackgroundRefresh();
    const fixture = await createFixture();
    try {
      return await run(fixture);
    } finally {
      await drainRelationshipRefreshTasks();
      assert.equal(
        getPendingRelationshipRefreshTaskCount(),
        0,
        "relationship refresh must settle before fixture cleanup",
      );
      await cleanupFixture(fixture);
      liveFixtures.delete(fixture);
    }
  }

  it("creates, sends, and pays a merchant invoice", async () => {
    await withFixture(async (fixture) => {
      const merchant = await loadAltaUserOrThrow(fixture.merchantUserId);
      const payer = await loadAltaUserOrThrow(fixture.payerUserId);
      const invoiceAmount = 42.5;

      const draft = await createMerchantInvoiceDraft(merchant, {
        companyId: fixture.companyId,
        amount: invoiceAmount,
        description: `Integration test invoice ${fixture.tag}`,
        recipientUserId: fixture.payerUserId,
        memo: "Automated test",
      });
      fixture.invoiceIds.push(draft.id);
      assert.equal(draft.status, "DRAFT");

      const sent = await sendMerchantInvoice(
        merchant,
        fixture.companyId,
        draft.id,
        "integration-test",
      );
      assert.equal(sent.status, "SENT");

      const payResult = await payMerchantInvoice(
        payer,
        {
          invoiceId: draft.id,
          fundingSource: { kind: "bank_account", accountId: fixture.payerAccountId },
          idempotencyKey: idempotencyKey("inv"),
        },
        { source: "integration-test" },
      );
      assert.equal(payResult.amount, invoiceAmount);

      const detail = await getMerchantInvoiceDetail(merchant, fixture.companyId, draft.id);
      assert.equal(detail.status, "PAID");
      assert.ok(detail.paidAt);

      const dashboard = await getMerchantInvoiceDashboard(merchant, fixture.companyId);
      assert.ok(dashboard.recent.some((row) => row.id === draft.id));
    });
  });

  it("creates and pays a fixed payment link", async () => {
    await withFixture(async (fixture) => {
      const merchant = await loadAltaUserOrThrow(fixture.merchantUserId);
      const payer = await loadAltaUserOrThrow(fixture.payerUserId);
      const linkAmount = 17.25;

      const link = await createPaymentLink(
        merchant,
        {
          companyId: fixture.companyId,
          description: `Integration test payment link ${fixture.tag}`,
          amountType: "FIXED",
          usageType: "REUSABLE",
          amount: linkAmount,
        },
        "integration-test",
      );
      fixture.paymentLinkIds.push(link.id);
      assert.equal(link.status, "ACTIVE");
      assert.ok(link.slug);

      const payResult = await payPaymentLink(
        payer,
        {
          slug: link.slug,
          amount: linkAmount,
          fundingSource: { kind: "bank_account", accountId: fixture.payerAccountId },
          idempotencyKey: idempotencyKey("plink"),
        },
        { source: "integration-test" },
      );
      assert.equal(payResult.amount, linkAmount);

      const detail = await getPaymentLinkDetail(merchant, fixture.companyId, link.id);
      assert.equal(detail.paymentCount, 1);
      assert.ok(detail.recentPayments.length >= 1);

      const dashboard = await getPaymentLinkDashboard(merchant, fixture.companyId);
      assert.ok(dashboard.recent.some((row) => row.id === link.id));
    });
  });

  it("includes invoice and payment link deposits in customer payments received", async () => {
    await withFixture(async (fixture) => {
      const merchant = await loadAltaUserOrThrow(fixture.merchantUserId);
      const payer = await loadAltaUserOrThrow(fixture.payerUserId);
      const invoiceAmount = 33.33;
      const linkAmount = 22.22;

      const before = await listCompanyAltaPayReceived(merchant, fixture.companyId);

      const invoice = await createMerchantInvoiceDraft(merchant, {
        companyId: fixture.companyId,
        amount: invoiceAmount,
        description: `Received summary invoice test ${fixture.tag}`,
        recipientUserId: fixture.payerUserId,
      });
      fixture.invoiceIds.push(invoice.id);
      await sendMerchantInvoice(merchant, fixture.companyId, invoice.id, "integration-test");
      const invoicePay = await payMerchantInvoice(
        payer,
        {
          invoiceId: invoice.id,
          fundingSource: { kind: "bank_account", accountId: fixture.payerAccountId },
          idempotencyKey: idempotencyKey("inv-recv"),
        },
        { source: "integration-test" },
      );

      const link = await createPaymentLink(
        merchant,
        {
          companyId: fixture.companyId,
          description: `Received summary link test ${fixture.tag}`,
          amountType: "FIXED",
          usageType: "REUSABLE",
          amount: linkAmount,
        },
        "integration-test",
      );
      fixture.paymentLinkIds.push(link.id);
      const linkPay = await payPaymentLink(
        payer,
        {
          slug: link.slug,
          amount: linkAmount,
          fundingSource: { kind: "bank_account", accountId: fixture.payerAccountId },
          idempotencyKey: idempotencyKey("plink-recv"),
        },
        { source: "integration-test" },
      );

      const after = await listCompanyAltaPayReceived(merchant, fixture.companyId);

      assert.ok(
        after.totalThisMonth >= before.totalThisMonth + invoiceAmount + linkAmount - 0.01,
      );
      assert.ok(after.paymentCountThisMonth >= before.paymentCountThisMonth + 2);

      const refs = new Set(after.recentPayments.map((p) => p.referenceCode));
      assert.ok(refs.has(invoicePay.paymentReferenceCode));
      assert.ok(refs.has(linkPay.paymentReferenceCode));

      const invoiceRow = after.recentPayments.find(
        (p) => p.referenceCode === invoicePay.paymentReferenceCode,
      );
      const linkRow = after.recentPayments.find(
        (p) => p.referenceCode === linkPay.paymentReferenceCode,
      );
      assert.ok(invoiceRow);
      assert.ok(linkRow);
      assert.equal(invoiceRow!.amount, invoiceAmount);
      assert.equal(linkRow!.amount, linkAmount);
    });
  });
});

describe("customer payment payer label extraction", () => {
  it("parses alta pay, invoice, and payment link deposit descriptions", async () => {
    const { extractReceivedCustomerPayerLabel } = await import(
      "@/server/customer-payments-received"
    );

    assert.equal(
      extractReceivedCustomerPayerLabel("Alta Pay from TestCustomer"),
      "TestCustomer",
    );
    assert.equal(
      extractReceivedCustomerPayerLabel("Merchant invoice payment from Acme Corp"),
      "Acme Corp",
    );
    assert.equal(
      extractReceivedCustomerPayerLabel("Payment link from jane_doe"),
      "jane_doe",
    );
  });

  it("parses alta pay, invoice, and payment link withdrawal descriptions", async () => {
    const { extractSentCustomerPayeeLabel } = await import("@/server/customer-payments-received");

    assert.equal(extractSentCustomerPayeeLabel("Alta Pay to District Construction LLC"), "District Construction LLC");
    assert.equal(
      extractSentCustomerPayeeLabel("Merchant invoice payment to Acme Corp"),
      "Acme Corp",
    );
    assert.equal(extractSentCustomerPayeeLabel("Payment link to Acme Corp"), "Acme Corp");
  });
});
