import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALTA_PAY_LEGACY_TAB_MAP,
  TRANSFER_LEGACY_TAB_MAP,
  parseAltaPayRecordSearch,
  parseInvoiceRecordSearch,
  parsePaymentLinkRecordSearch,
  parseTransferRecordSearch,
  isSafeInternalFrom,
  buildListReturnPath,
} from "@/lib/internal/record-workspace-search";
import {
  availableTransferActions,
  buildTransferLifecycle,
  parseTransferListFilter,
  plainTransferStatusLabel,
  plainTransferTypeTitle,
  transferAttentionCopy,
  transferMatchesListFilter,
  transferNeedsAttention,
} from "@/lib/internal/transfer-record-copy";
import { inboxItemFromException } from "@/lib/internal/inbox-normalize";
import { parseReturnPath } from "@/lib/internal/record-return-context";
import { relatedRecordHref } from "@/components/internal/workspace/related-records";
import type { ExceptionItem } from "@/lib/internal/ops-types";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function sampleTransfer(
  overrides: Partial<InternalScheduledTransferRow> = {},
): InternalScheduledTransferRow {
  return {
    id: "xfer-1",
    label: "Test",
    amount: 100,
    currency: "FLD",
    status: "approved",
    statusLabel: "Active",
    paymentType: "recurring",
    transferScope: "INTRABANK",
    sourceAccountId: "acc-1",
    sourceAccountName: "Operating",
    sourceAccountNumber: "AB-1",
    destinationAccountNumber: "AB-2",
    destinationName: "Reserve",
    ownerLabel: "Alta Group",
    ownerType: "company",
    companyId: "co-1",
    nextRunAt: "2026-08-01T00:00:00.000Z",
    lastRunAt: "2026-07-01T00:00:00.000Z",
    consecutiveFailures: 0,
    lastFailureReason: null,
    lastExecutionStatus: "executed",
    lastExecutionStatusLabel: "Executed",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 6 transfer record normalization", () => {
  it("parses transfer search and rejects unsafe from", () => {
    assert.deepEqual(parseTransferRecordSearch({}), {});
    assert.deepEqual(parseTransferRecordSearch({ tab: "lifecycle" }), { section: "lifecycle" });
    assert.equal(parseTransferRecordSearch({ from: "https://evil.example" }).from, undefined);
    assert.ok(TRANSFER_LEGACY_TAB_MAP.executions);
  });

  it("distinguishes schedule status labels and types", () => {
    assert.equal(plainTransferTypeTitle(sampleTransfer()), "Recurring transfer");
    assert.equal(plainTransferTypeTitle(sampleTransfer({ paymentType: "one_time" })), "Scheduled transfer");
    assert.equal(plainTransferStatusLabel("approved", "Active"), "Active");
    assert.equal(plainTransferStatusLabel("executed"), "Completed");
  });

  it("builds lifecycle stages from real statuses only", () => {
    const life = buildTransferLifecycle(sampleTransfer({ status: "failed", lastFailureReason: "Insufficient" }));
    assert.ok(life.some((s) => s.id === "failed"));
    assert.ok(life.every((s) => ["created", "scheduled", "processing", "completed", "failed", "cancelled"].includes(s.id)));
  });

  it("exposes state-aware actions and hides them when resolved", () => {
    assert.deepEqual(availableTransferActions(sampleTransfer({ status: "approved" })).sort(), [
      "cancel",
      "pause",
      "run_now",
    ]);
    assert.deepEqual(availableTransferActions(sampleTransfer({ status: "executed" })), []);
    assert.deepEqual(availableTransferActions(sampleTransfer({ status: "cancelled" })), []);
    assert.ok(transferNeedsAttention(sampleTransfer({ status: "failed" })));
    assert.match(transferAttentionCopy(sampleTransfer({ status: "failed", lastFailureReason: "Balance" })) ?? "", /Balance/);
  });

  it("filters list rows including scheduled type vs completed status", () => {
    assert.equal(parseTransferListFilter("scheduled"), "scheduled");
    assert.equal(transferMatchesListFilter(sampleTransfer({ status: "approved", paymentType: "recurring" }), "scheduled"), true);
    assert.equal(transferMatchesListFilter(sampleTransfer({ status: "approved" }), "active"), true);
    assert.equal(transferMatchesListFilter(sampleTransfer({ status: "paused" }), "paused"), true);
    assert.equal(transferMatchesListFilter(sampleTransfer({ status: "executed" }), "completed"), true);
    assert.equal(transferMatchesListFilter(sampleTransfer({ status: "failed" }), "pending"), false);
  });

  it("does not reintroduce interbank as a supported capability in transfer UI", () => {
    const list = read("routes/internal/bank/transfers/index.tsx");
    const view = read("components/internal/workspace/scheduled-transfer-workspace-view.tsx");
    assert.match(list, /interbank.*not available|not available/i);
    assert.doesNotMatch(view, /Create interbank|Send interbank|Interbank transfer available/i);
  });
});

describe("Phase 6 Alta Pay / invoice / payment-link search", () => {
  it("maps legacy tabs for payments and invoices", () => {
    assert.deepEqual(parseAltaPayRecordSearch({ tab: "related" }), { section: "related" });
    assert.deepEqual(parseInvoiceRecordSearch({ tab: "reminders" }), { section: "reminders" });
    assert.deepEqual(parsePaymentLinkRecordSearch({ section: "technical" }), { section: "technical" });
    assert.ok(ALTA_PAY_LEGACY_TAB_MAP.reminders);
  });

  it("keeps reminder copy from implying payment status changes", () => {
    const invoice = read("components/internal/workspace/invoice-workspace-view.tsx");
    assert.match(invoice, /outreach history only/);
    assert.match(invoice, /do not change payment status/);
    assert.doesNotMatch(invoice, /reminder marks.*paid|sending a reminder (will |marks )/i);
  });

  it("links related money records with site-safe hrefs", () => {
    assert.equal(
      relatedRecordHref({ kind: "scheduled_transfer", id: "abc", label: "x" }),
      "/internal/bank/transfers/abc",
    );
    assert.equal(
      relatedRecordHref({ kind: "alta_pay", id: "APAY-1", label: "x" }),
      "/internal/bank/alta-pay/APAY-1",
    );
    assert.equal(
      relatedRecordHref({ kind: "invoice", id: "inv-1", label: "x" }),
      "/internal/bank/alta-pay/invoices/inv-1",
    );
    assert.equal(
      relatedRecordHref({ kind: "payment_link", id: "pl-1", label: "x" }),
      "/internal/bank/alta-pay/payment-links/pl-1",
    );
  });
});

describe("Phase 6 inbox + return context", () => {
  it("routes failed transfer exceptions to transfer records", () => {
    const item = inboxItemFromException({
      id: "stf-xfer-9",
      category: "failed_transfer",
      severity: "high",
      title: "Payroll float",
      detail: "Insufficient available balance",
      href: "/internal/bank/transfers/ui-lab-xfer-failed",
      amount: 12000,
      createdAt: "2026-07-27T00:00:00.000Z",
    } satisfies ExceptionItem);
    assert.ok(item);
    assert.equal(item!.destination.to, "/internal/bank/transfers/$transferId");
    assert.equal(item!.destination.params?.transferId, "ui-lab-xfer-failed");
    assert.equal(item!.partyLabel, "Failed transfer");
  });

  it("preserves safe return context for money ops lists", () => {
    const from = buildListReturnPath("/internal/bank/transfers", { status: "failed" });
    assert.equal(from, "/internal/bank/transfers?status=failed");
    assert.ok(isSafeInternalFrom(from));
    assert.equal(parseReturnPath(from)?.label, "Transfers");
    assert.equal(parseReturnPath("/internal/bank/alta-pay")?.label, "Alta Pay");
    assert.equal(parseReturnPath("https://evil.example") , null);
  });
});

describe("Phase 6 ops pages + legacy maps", () => {
  it("redirects legacy scheduled route into transfers", () => {
    const scheduled = read("routes/internal/bank/scheduled.tsx");
    assert.match(scheduled, /redirect/);
    assert.match(scheduled, /\/internal\/bank\/transfers/);
    assert.match(scheduled, /status:\s*"scheduled"/);
  });

  it("interest and statement pages are operational control summaries", () => {
    const interest = read("routes/internal/bank/interest.tsx");
    const statements = read("routes/internal/bank/statements.tsx");
    assert.match(interest, /OpsSection title="Status"/);
    assert.match(interest, /Accounts requiring attention|Interest actions|deposit interest/i);
    assert.match(statements, /Latest generation run/);
    assert.match(statements, /System Jobs/);
    assert.match(statements, /Review account statements/);
    assert.doesNotMatch(statements, />\s*Open account\s*</);
  });

  it("blocks live money mutations in UI Lab fetch wrappers", () => {
    const transfers = read("lib/bank/scheduled-transfer-admin.functions.ts");
    const altaPay = read("lib/internal/ops-platform.functions.ts");
    const interest = read("lib/bank/account-interest.functions.ts");
    assert.match(transfers, /disabled in UI Lab/);
    assert.match(altaPay, /disabled in UI Lab/);
    assert.match(interest, /disabled in UI Lab/);
  });
});

describe("Phase 6 InternalPageShell regression", () => {
  it("landing pages use InternalPageShell without unstable effect deps", () => {
    const shell = read("components/internal/internal-page-shell.tsx");
    assert.match(shell, /breadcrumbKey/);
    assert.match(shell, /actionsKey/);
    assert.doesNotMatch(shell, /resolvedBreadcrumbs\]/);
    for (const page of [
      "routes/internal/alta-card/index.tsx",
      "routes/internal/lending/index.tsx",
      "routes/internal/bank/transfers/index.tsx",
      "routes/internal/bank/alta-pay/index.tsx",
      "routes/internal/bank/interest.tsx",
      "routes/internal/bank/statements.tsx",
    ]) {
      assert.match(read(page), /InternalPageShell/);
    }
  });
});
