/**
 * Integration test for merchant invoices and payment links.
 * Requires DATABASE_URL pointing at a local/dev database.
 *
 *   npx tsx --test src/lib/bank/merchant-invoice-payment-link.integration.test.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { prisma } from "@/server/db";
import { loadAltaUserOrThrow } from "@/server/bank-account-access.service";
import {
  createMerchantInvoiceDraft,
  getMerchantInvoiceDashboard,
  getMerchantInvoiceDetail,
  sendMerchantInvoice,
} from "@/server/merchant-invoice.service";
import { payMerchantInvoice } from "@/server/merchant-invoice-payment.service";
import {
  createPaymentLink,
  getPaymentLinkDashboard,
  getPaymentLinkDetail,
} from "@/server/payment-link.service";
import { payPaymentLink } from "@/server/payment-link-payment.service";
import { listCompanyAltaPayReceived } from "@/server/alta-pay.service";

function idempotencyKey(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

async function findTestActors() {
  const company = await prisma.company.findFirst({
    where: {
      verificationStatus: "VERIFIED",
      bankAccounts: { some: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" } },
      memberships: { some: { role: "OWNER" } },
    },
    include: {
      memberships: { where: { role: "OWNER" }, take: 1 },
    },
  });
  if (!company) return null;

  const payer = await prisma.user.findFirst({
    where: {
      accountStatus: "ACTIVE",
      id: { not: company.memberships[0]?.userId },
      bankAccounts: {
        some: {
          companyId: null,
          status: "ACTIVE",
          accountType: { in: ["CHECKING", "SAVINGS"] },
          restrictWithdrawals: false,
        },
      },
      NOT: {
        companyMemberships: { some: { companyId: company.id } },
      },
    },
    include: {
      bankAccounts: {
        where: { companyId: null, status: "ACTIVE", restrictWithdrawals: false },
        take: 1,
      },
    },
  });
  if (!payer?.bankAccounts[0]) return null;

  return {
    companyId: company.id,
    merchantUserId: company.memberships[0]!.userId,
    payerUserId: payer.id,
    payerAccountId: payer.bankAccounts[0].id,
  };
}

describe("merchant invoice and payment link integration", { skip: !hasDatabaseUrl() }, () => {
  it("creates, sends, and pays a merchant invoice", async () => {
    const actors = await findTestActors();
    assert.ok(actors, "Need verified company with owner and external payer account");

    const merchant = await loadAltaUserOrThrow(actors.merchantUserId);
    const payer = await loadAltaUserOrThrow(actors.payerUserId);
    const invoiceAmount = 42.5;

    const draft = await createMerchantInvoiceDraft(merchant, {
      companyId: actors.companyId,
      amount: invoiceAmount,
      description: "Integration test invoice",
      recipientUserId: actors.payerUserId,
      memo: "Automated test",
    });
    assert.equal(draft.status, "DRAFT");

    const sent = await sendMerchantInvoice(
      merchant,
      actors.companyId,
      draft.id,
      "integration-test",
    );
    assert.equal(sent.status, "SENT");

    const payResult = await payMerchantInvoice(
      payer,
      {
        invoiceId: draft.id,
        fundingSource: { kind: "bank_account", accountId: actors.payerAccountId },
        idempotencyKey: idempotencyKey("inv"),
      },
      { source: "integration-test" },
    );
    assert.equal(payResult.amount, invoiceAmount);

    const detail = await getMerchantInvoiceDetail(merchant, actors.companyId, draft.id);
    assert.equal(detail.status, "PAID");
    assert.ok(detail.paidAt);

    const dashboard = await getMerchantInvoiceDashboard(merchant, actors.companyId);
    assert.ok(dashboard.recent.some((row) => row.id === draft.id));
  });

  it("creates and pays a fixed payment link", async () => {
    const actors = await findTestActors();
    assert.ok(actors, "Need verified company with owner and external payer account");

    const merchant = await loadAltaUserOrThrow(actors.merchantUserId);
    const payer = await loadAltaUserOrThrow(actors.payerUserId);
    const linkAmount = 17.25;

    const link = await createPaymentLink(
      merchant,
      {
        companyId: actors.companyId,
        description: "Integration test payment link",
        amountType: "FIXED",
        usageType: "REUSABLE",
        amount: linkAmount,
      },
      "integration-test",
    );
    assert.equal(link.status, "ACTIVE");
    assert.ok(link.slug);

    const payResult = await payPaymentLink(
      payer,
      {
        slug: link.slug,
        amount: linkAmount,
        fundingSource: { kind: "bank_account", accountId: actors.payerAccountId },
        idempotencyKey: idempotencyKey("plink"),
      },
      { source: "integration-test" },
    );
    assert.equal(payResult.amount, linkAmount);

    const detail = await getPaymentLinkDetail(merchant, actors.companyId, link.id);
    assert.equal(detail.paymentCount, 1);
    assert.ok(detail.recentPayments.length >= 1);

    const dashboard = await getPaymentLinkDashboard(merchant, actors.companyId);
    assert.ok(dashboard.recent.some((row) => row.id === link.id));
  });

  it("includes invoice and payment link deposits in customer payments received", async () => {
    const actors = await findTestActors();
    assert.ok(actors, "Need verified company with owner and external payer account");

    const merchant = await loadAltaUserOrThrow(actors.merchantUserId);
    const payer = await loadAltaUserOrThrow(actors.payerUserId);
    const invoiceAmount = 33.33;
    const linkAmount = 22.22;

    const before = await listCompanyAltaPayReceived(merchant, actors.companyId);

    const invoice = await createMerchantInvoiceDraft(merchant, {
      companyId: actors.companyId,
      amount: invoiceAmount,
      description: "Received summary invoice test",
      recipientUserId: actors.payerUserId,
    });
    await sendMerchantInvoice(merchant, actors.companyId, invoice.id, "integration-test");
    const invoicePay = await payMerchantInvoice(
      payer,
      {
        invoiceId: invoice.id,
        fundingSource: { kind: "bank_account", accountId: actors.payerAccountId },
        idempotencyKey: idempotencyKey("inv-recv"),
      },
      { source: "integration-test" },
    );

    const link = await createPaymentLink(
      merchant,
      {
        companyId: actors.companyId,
        description: "Received summary link test",
        amountType: "FIXED",
        usageType: "REUSABLE",
        amount: linkAmount,
      },
      "integration-test",
    );
    const linkPay = await payPaymentLink(
      payer,
      {
        slug: link.slug,
        amount: linkAmount,
        fundingSource: { kind: "bank_account", accountId: actors.payerAccountId },
        idempotencyKey: idempotencyKey("plink-recv"),
      },
      { source: "integration-test" },
    );

    const after = await listCompanyAltaPayReceived(merchant, actors.companyId);

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
