import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  UI_LAB_CORE_ACCOUNT_ID,
  UI_LAB_CORE_COMPANY_ID,
  UI_LAB_HARBOR_COMPANY_ID,
  UI_LAB_PRO_ACCOUNT_ID,
  UI_LAB_PRO_COMPANY_ID,
  createUiLabInvoiceDraft,
  sendUiLabInvoice,
  updateUiLabInvoiceDraft,
  remindUiLabInvoice,
  cancelUiLabInvoice,
  getUiLabBusinessBankingOverview,
  getUiLabInvoiceDashboard,
  getUiLabInvoiceDetail,
  getUiLabMerchantAnalytics,
  getUiLabSubscriptionChargeHistory,
  getUiLabAccountStatements,
  getUiLabStatementDetail,
  generateUiLabAccountStatement,
  resetUiLabCommercialOverlays,
  resolveUiLabOperatingAccountId,
  searchUiLabInvoiceRecipients,
} from "./ui-lab-commercial-fixtures.ts";
import {
  assertWholePercentagePoints,
  formatMerchantAnalyticsPercent,
  looksLikeFractionalPercent,
} from "./merchant-analytics-percent.ts";
import { formatCommercialBillingPeriodLabel } from "./commercial-billing-history-types.ts";

describe("ui-lab business hub overview identities", () => {
  it("uses canonical Core and Pro operating account IDs", () => {
    const overview = getUiLabBusinessBankingOverview();
    assert.deepEqual(
      overview.companies.map((c) => c.operatingAccount.id).sort(),
      [UI_LAB_CORE_ACCOUNT_ID, UI_LAB_PRO_ACCOUNT_ID].sort(),
    );
    assert.equal(resolveUiLabOperatingAccountId(UI_LAB_CORE_COMPANY_ID), UI_LAB_CORE_ACCOUNT_ID);
    assert.equal(resolveUiLabOperatingAccountId(UI_LAB_PRO_COMPANY_ID), UI_LAB_PRO_ACCOUNT_ID);

    const selected = getUiLabBusinessBankingOverview(UI_LAB_PRO_COMPANY_ID);
    assert.equal(selected.selectedCompanyId, UI_LAB_PRO_COMPANY_ID);
    const pro = selected.companies.find((c) => c.companyId === UI_LAB_PRO_COMPANY_ID);
    assert.equal(pro?.operatingAccount.id, UI_LAB_PRO_ACCOUNT_ID);
  });
});

describe("merchant analytics percentage contract", () => {
  it("formats whole percentage points without fractional noise", () => {
    assert.equal(formatMerchantAnalyticsPercent(97), "97%");
    assert.equal(formatMerchantAnalyticsPercent(3), "3%");
    assert.equal(formatMerchantAnalyticsPercent(0), "0%");
    assert.equal(formatMerchantAnalyticsPercent(100), "100%");
    assert.equal(formatMerchantAnalyticsPercent(80), "80%");
  });

  it("rejects mixing 0–1 fractions with 0–100 points", () => {
    assert.equal(looksLikeFractionalPercent(0.97), true);
    assert.equal(looksLikeFractionalPercent(97), false);
    assert.throws(() => assertWholePercentagePoints(0.97, "paymentSuccessRate"));
  });

  it("UI Lab Pro analytics use whole percentage points", () => {
    const analytics = getUiLabMerchantAnalytics(UI_LAB_PRO_COMPANY_ID);
    assert.equal(analytics.paymentSuccessRate, 97);
    assert.equal(analytics.paymentFailureRate, 3);
    assert.equal(
      formatMerchantAnalyticsPercent(analytics.paymentSuccessRate),
      "97%",
    );
    assert.equal(
      formatMerchantAnalyticsPercent(analytics.paymentFailureRate),
      "3%",
    );
  });
});

describe("ui-lab invoice recipient search", () => {
  it("matches Harbor person and verified company", () => {
    const hits = searchUiLabInvoiceRecipients("Harbor");
    assert.ok(hits.some((r) => r.kind === "person" && r.displayName.includes("Harbor")));
    assert.ok(
      hits.some(
        (r) => r.kind === "company" && r.id === UI_LAB_HARBOR_COMPANY_ID && r.canReceive,
      ),
    );
  });

  it("returns empty for no-match queries", () => {
    assert.deepEqual(searchUiLabInvoiceRecipients("zzz"), []);
    assert.deepEqual(searchUiLabInvoiceRecipients(""), []);
  });

  it("selects a person and a verified company with eligibility", () => {
    const person = searchUiLabInvoiceRecipients("Ava").find((r) => r.kind === "person");
    assert.ok(person);
    assert.equal(person!.canReceive, true);

    const company = searchUiLabInvoiceRecipients("Harbor Logistics").find(
      (r) => r.kind === "company",
    );
    assert.ok(company);
    assert.equal(company!.canReceive, true);
  });

  it("marks ineligible recipients as not receivable", () => {
    const riley = searchUiLabInvoiceRecipients("Riley").find((r) => r.id.includes("riley"));
    assert.ok(riley);
    assert.equal(riley!.canReceive, false);
  });

  it("completes an in-memory invoice draft without database writes", () => {
    resetUiLabCommercialOverlays();
    const draft = createUiLabInvoiceDraft({
      companyId: UI_LAB_PRO_COMPANY_ID,
      recipientUserId: "ui-lab-person-harbor",
      amount: 1250,
      description: "Harbor site services",
    });
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.recipientName, "Harbor Line");
    assert.match(draft.referenceCode, /^INV-UILAB-/);
    assert.equal(getUiLabInvoiceDashboard(UI_LAB_PRO_COMPANY_ID).recent[0]?.id, draft.id);
    assert.equal(getUiLabInvoiceDetail(UI_LAB_PRO_COMPANY_ID, draft.id)?.id, draft.id);
  });

  it("rejects ineligible recipients on create", () => {
    resetUiLabCommercialOverlays();
    assert.throws(
      () =>
        createUiLabInvoiceDraft({
          companyId: UI_LAB_PRO_COMPANY_ID,
          recipientUserId: "ui-lab-person-riley",
          amount: 100,
          description: "Should fail",
        }),
      /cannot receive/i,
    );
  });

  it("persists draft → update → send → remind → cancel without production IDs", () => {
    resetUiLabCommercialOverlays();
    const draft = createUiLabInvoiceDraft({
      companyId: UI_LAB_PRO_COMPANY_ID,
      recipientCompanyId: UI_LAB_HARBOR_COMPANY_ID,
      amount: 2500,
      description: "Harbor logistics retainer",
    });
    assert.match(draft.id, /^ui-lab-inv-/);
    assert.doesNotMatch(draft.id, /^cm|^cuid/i);

    const updated = updateUiLabInvoiceDraft({
      companyId: UI_LAB_PRO_COMPANY_ID,
      invoiceId: draft.id,
      amount: 2750,
      description: "Harbor logistics retainer (revised)",
    });
    assert.equal(updated.status, "DRAFT");
    assert.equal(updated.amount, 2750);

    const sent = sendUiLabInvoice(UI_LAB_PRO_COMPANY_ID, draft.id);
    assert.equal(sent.status, "SENT");
    assert.ok(sent.sentAt);
    assert.equal(sent.recipientName, "Harbor Logistics Ltd.");
    assert.equal(
      getUiLabInvoiceDashboard(UI_LAB_PRO_COMPANY_ID).recent.find((row) => row.id === draft.id)
        ?.status,
      "SENT",
    );
    assert.equal(getUiLabInvoiceDetail(UI_LAB_PRO_COMPANY_ID, draft.id)?.status, "SENT");

    const reminded = remindUiLabInvoice(UI_LAB_PRO_COMPANY_ID, draft.id);
    assert.ok(reminded.events.some((event) => event.eventType === "REMINDER_SENT"));

    const cancelled = cancelUiLabInvoice(UI_LAB_PRO_COMPANY_ID, draft.id);
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(getUiLabInvoiceDetail(UI_LAB_PRO_COMPANY_ID, draft.id)?.status, "CANCELLED");
  });

  it("keeps invoice session state isolated by company", () => {
    resetUiLabCommercialOverlays();
    const proDraft = createUiLabInvoiceDraft({
      companyId: UI_LAB_PRO_COMPANY_ID,
      recipientCompanyId: UI_LAB_HARBOR_COMPANY_ID,
      amount: 100,
      description: "Pro only",
    });
    assert.equal(
      getUiLabInvoiceDetail(UI_LAB_CORE_COMPANY_ID, proDraft.id),
      null,
    );
    assert.ok(
      !getUiLabInvoiceDashboard(UI_LAB_CORE_COMPANY_ID).recent.some((row) => row.id === proDraft.id),
    );
  });
});

describe("ui-lab statement fixtures", () => {
  afterEach(() => resetUiLabCommercialOverlays());

  it("returns serializable Core and Pro statement lists with account isolation", () => {
    const pro = getUiLabAccountStatements(UI_LAB_PRO_ACCOUNT_ID);
    const core = getUiLabAccountStatements(UI_LAB_CORE_ACCOUNT_ID);
    assert.ok(pro.length >= 1);
    assert.ok(core.length >= 1);
    assert.ok(pro.every((row) => row.bankAccountId === UI_LAB_PRO_ACCOUNT_ID));
    assert.ok(core.every((row) => row.bankAccountId === UI_LAB_CORE_ACCOUNT_ID));
    assert.ok(pro.every((row) => row.companyId === UI_LAB_PRO_COMPANY_ID));
    assert.ok(core.every((row) => row.companyId === UI_LAB_CORE_COMPANY_ID));

    const roundTrip = JSON.parse(JSON.stringify(pro)) as typeof pro;
    assert.deepEqual(roundTrip, pro);
    assert.equal(typeof pro[0]!.openingBalance, "number");
    assert.equal(typeof pro[0]!.closingBalance, "number");
    assert.equal(typeof pro[0]!.periodStart, "string");
  });

  it("returns serializable statement detail with transaction rows", () => {
    const summary = getUiLabAccountStatements(UI_LAB_PRO_ACCOUNT_ID)[0];
    assert.ok(summary);
    const detail = getUiLabStatementDetail(summary!.id);
    assert.ok(detail);
    assert.ok(detail!.transactions.length >= 1);
    const roundTrip = JSON.parse(JSON.stringify(detail));
    assert.deepEqual(roundTrip, detail);
  });

  it("supports in-memory statement generation for UI Lab accounts", () => {
    const created = generateUiLabAccountStatement({
      accountId: UI_LAB_CORE_ACCOUNT_ID,
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
    });
    assert.equal(created.bankAccountId, UI_LAB_CORE_ACCOUNT_ID);
    assert.equal(getUiLabAccountStatements(UI_LAB_CORE_ACCOUNT_ID)[0]?.id, created.id);
    assert.equal(getUiLabStatementDetail(created.id)?.id, created.id);
  });
});

describe("commercial billing history helpers", () => {
  afterEach(() => resetUiLabCommercialOverlays());

  it("formats billing periods for customers", () => {
    assert.equal(formatCommercialBillingPeriodLabel("initial"), "Initial purchase");
    assert.match(formatCommercialBillingPeriodLabel("2026-07-14"), /Jul/);
  });

  it("Pro fixture includes purchase, renewal, and a safe failure", () => {
    const rows = getUiLabSubscriptionChargeHistory(UI_LAB_PRO_COMPANY_ID);
    assert.ok(rows.some((r) => r.chargeType === "INITIAL_PURCHASE" && r.status === "SUCCEEDED"));
    assert.ok(rows.some((r) => r.chargeType === "MONTHLY_RENEWAL" && r.status === "SUCCEEDED"));
    const failed = rows.find((r) => r.status === "FAILED");
    assert.ok(failed);
    assert.ok(failed!.failureReason);
    assert.doesNotMatch(failed!.failureReason!, /prisma|stack|idempotency/i);
  });

  it("Core fixture has empty charge history", () => {
    assert.deepEqual(getUiLabSubscriptionChargeHistory(UI_LAB_CORE_COMPANY_ID), []);
  });
});
