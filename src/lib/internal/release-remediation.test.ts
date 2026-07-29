import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getUiLabInternalBankAccountDetail,
  getUiLabInternalBankAccountRows,
  getUiLabTransactionDetail,
  getUiLabTransactionExplorer,
  listUiLabTransactionExplorerRows,
  UI_LAB_INTERNAL_ACCOUNT_IDS,
} from "@/lib/bank/ui-lab-money-ops-fixtures";
import {
  hrefHasDuplicateQueryDelimiter,
  parseInternalSearchHref,
} from "@/lib/internal/navigate-internal-search-href";
import { serializeInternalSearch } from "@/lib/internal/normalize-internal-search";
import {
  canAcceptLoanPayment,
  loanPaymentUnavailableCopy,
} from "@/lib/internal/lending-desk";
import {
  dedupeHomePlatformSignals,
  formatHomePlatformSignalLabel,
  selectHomePlatformStatus,
} from "@/lib/internal/home-attention";
import type { OpsHealthItem } from "@/lib/internal/ops-types";
import { searchUiLabTerminalOps } from "@/lib/terminal/ui-lab-terminal-ops-fixtures";
import { formatTerminalOrderSearchSublabel } from "@/lib/terminal/terminal-desk";
import type { TerminalOpsOrderRow } from "@/lib/terminal/terminal-ops-types";
import {
  buildTransferLifecycle,
  transferAttentionCopy,
  transferAttentionLabel,
} from "@/lib/internal/transfer-record-copy";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function sampleLoan(
  partial: Partial<InternalActiveLoanRow> & Pick<InternalActiveLoanRow, "status">,
): InternalActiveLoanRow {
  return {
    id: "LN-TEST",
    productLabel: "Test loan",
    borrowerLabel: "Borrower",
    statusLabel: partial.status.replace(/_/g, " "),
    paymentStatusLabel: "Current",
    riskStatusLabel: "Normal",
    currentPayoffAmount: 1_000,
    guaranteedInterestOwed: 0,
    principalOutstanding: 1_000,
    accruedInterest: 0,
    linkedBankAccountId: "BA-1",
    linkedAccountNumber: "AB-1",
    paymentSchedule: [],
    termMonths: 12,
    lastPaymentAt: null,
    nextInterestAccrualAt: null,
    companyName: null,
    borrowerUserId: "u1",
    companyId: null,
    approvedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  } as InternalActiveLoanRow;
}

describe("Release remediation — UI Lab account fixture integrity", () => {
  it("resolves every directory account via the record detail fixture", () => {
    const rows = getUiLabInternalBankAccountRows();
    assert.ok(rows.length > 0);
    assert.deepEqual(
      rows.map((r) => r.id).sort(),
      [...UI_LAB_INTERNAL_ACCOUNT_IDS].sort(),
    );
    for (const row of rows) {
      const detail = getUiLabInternalBankAccountDetail(row.id);
      assert.ok(detail, `missing detail for ${row.id}`);
      assert.equal(detail!.id, row.id);
      assert.equal(detail!.accountNumber, row.accountNumber);
    }
  });

  it("wires internal account detail loader to the UI Lab fixture source", () => {
    const src = read("lib/bank/bank.functions.ts");
    assert.match(src, /getUiLabInternalBankAccountDetail/);
    assert.match(src, /isUiLabMode/);
  });
});

describe("Release remediation — UI Lab transaction fixture integrity", () => {
  it("resolves every explorer transaction id via the detail fixture", () => {
    const all = listUiLabTransactionExplorerRows();
    assert.equal(all.length, 54);
    for (const row of all) {
      const detail = getUiLabTransactionDetail(row.id);
      assert.ok(detail, `missing detail for ${row.id}`);
      assert.equal(detail!.id, row.id);
      assert.equal(detail!.referenceCode, row.referenceCode);
      assert.ok(detail!.accountId);
    }
  });

  it("keeps pending deposit/withdrawal decision controls available", () => {
    const page = getUiLabTransactionExplorer({ limit: 54, offset: 0 });
    const pending = page.items.filter((t) => t.status === "PENDING");
    assert.ok(pending.length >= 3);
    for (const row of pending) {
      const detail = getUiLabTransactionDetail(row.id)!;
      assert.equal(detail.status, "PENDING");
      if (row.type === "DEPOSIT" || row.type === "WITHDRAWAL") {
        assert.ok(detail.proofImageUrl);
      }
    }
    const approved = allApproved(page.items);
    for (const row of approved.slice(0, 5)) {
      const detail = getUiLabTransactionDetail(row.id)!;
      assert.notEqual(detail.status, "PENDING");
    }
  });

  it("wires transaction detail loader to the UI Lab fixture source", () => {
    const src = read("lib/internal/ops-platform.functions.ts");
    assert.match(src, /getUiLabTransactionDetail/);
  });
});

function allApproved(items: Array<{ status: string; id: string; type: string }>) {
  return items.filter((t) => t.status === "APPROVED" || t.status === "DENIED");
}

describe("Release remediation — global search navigation", () => {
  const cases: Array<{ href: string; site?: string; expectSite: string; expectTab?: string }> = [
    { href: "/internal/users/ui-lab-user", site: "bank", expectSite: "bank" },
    { href: "/internal/users/ui-lab-user?tab=overview", site: "bank", expectSite: "bank", expectTab: "overview" },
    {
      href: "/internal/companies/CO-ALTG?tab=overview&section=relationship",
      site: "bank",
      expectSite: "bank",
      expectTab: "overview",
    },
    { href: "/internal/bank/accounts/ui-lab-biz-core", site: "corporate", expectSite: "corporate" },
    {
      href: "/internal/bank/transactions/ui-lab-tx-1?from=%2Finternal%2Finbox",
      site: "bank",
      expectSite: "bank",
    },
    { href: "/internal/lending/loans/LN-LAB-ACTIVE?tab=overview", site: "bank", expectSite: "bank", expectTab: "overview" },
    { href: "/internal/alta-card/CARD-1?tab=overview", site: "bank", expectSite: "bank", expectTab: "overview" },
    {
      href: "/internal/users/u1?tab=overview&section=relationship&from=%2Finternal%2Frelationships",
      site: "bank",
      expectSite: "bank",
      expectTab: "overview",
    },
    { href: "/internal/audit?action=LOGIN", site: "corporate", expectSite: "corporate" },
    {
      href: "/internal/terminal/portfolios/ui-lab-term-pf-core?tab=overview&site=terminal",
      site: "terminal",
      expectSite: "terminal",
      expectTab: "overview",
    },
    {
      href: "/internal/terminal/orders/ui-lab-term-ord-open-1?site=terminal",
      site: "terminal",
      expectSite: "terminal",
    },
    {
      href: "/internal/users/ui-lab-user?site=bank&tab=overview",
      site: "corporate",
      expectSite: "bank",
      expectTab: "overview",
    },
  ];

  it("parses destinations into pathname + normalized search without a second ?", () => {
    for (const c of cases) {
      const dest = parseInternalSearchHref(c.href, c.site);
      assert.ok(dest, `failed to parse ${c.href}`);
      assert.ok(dest!.to.startsWith("/internal"));
      assert.equal(dest!.search.site, c.expectSite);
      if (c.expectTab) assert.equal(dest!.search.tab, c.expectTab);
      const serialized = `${dest!.to}?${serializeInternalSearch(dest!.search)}`;
      assert.equal(hrefHasDuplicateQueryDelimiter(serialized), false, serialized);
      assert.ok(!serialized.includes("?site=") || serialized.indexOf("?") === serialized.lastIndexOf("?"));
    }
  });

  it("rejects non-internal destinations", () => {
    assert.equal(parseInternalSearchHref("/bank/accounts", "bank"), null);
    assert.equal(parseInternalSearchHref("https://evil.example/internal/users/x", "bank")?.to.startsWith("/internal"), true);
  });

  it("uses the helper for mouse and keyboard selection in global search", () => {
    const src = read("components/internal/internal-global-search.tsx");
    assert.match(src, /parseInternalSearchHref/);
    assert.doesNotMatch(src, /navigate\(\{\s*to:\s*withSiteParam/);
    assert.match(src, /search:\s*dest\.search/);
  });

  it("preserves fragments when present", () => {
    const dest = parseInternalSearchHref("/internal/lending/loans/LN-1?tab=overview#payments", "bank");
    assert.equal(dest?.hash, "payments");
    assert.equal(dest?.search.site, "bank");
  });
});

describe("Release remediation — loan payment eligibility", () => {
  it("allows only active loans with payoff due", () => {
    assert.equal(canAcceptLoanPayment(sampleLoan({ status: "active", currentPayoffAmount: 500 })), true);
    assert.equal(canAcceptLoanPayment(sampleLoan({ status: "frozen", currentPayoffAmount: 500 })), false);
    assert.equal(canAcceptLoanPayment(sampleLoan({ status: "paid_off", currentPayoffAmount: 0 })), false);
    assert.equal(canAcceptLoanPayment(sampleLoan({ status: "cancelled", currentPayoffAmount: 100 })), false);
    assert.equal(canAcceptLoanPayment(sampleLoan({ status: "defaulted", currentPayoffAmount: 100 })), false);
    assert.equal(canAcceptLoanPayment(sampleLoan({ status: "active", currentPayoffAmount: 0 })), false);
  });

  it("returns concise status copy when payment is unavailable", () => {
    assert.match(loanPaymentUnavailableCopy(sampleLoan({ status: "paid_off", currentPayoffAmount: 0 })) ?? "", /paid off/i);
    assert.match(loanPaymentUnavailableCopy(sampleLoan({ status: "frozen", currentPayoffAmount: 100 })) ?? "", /frozen/i);
    assert.match(loanPaymentUnavailableCopy(sampleLoan({ status: "cancelled", currentPayoffAmount: 100 })) ?? "", /cancelled/i);
    assert.match(loanPaymentUnavailableCopy(sampleLoan({ status: "defaulted", currentPayoffAmount: 100 })) ?? "", /default/i);
    assert.match(loanPaymentUnavailableCopy(sampleLoan({ status: "active", currentPayoffAmount: 0 })) ?? "", /No amount/i);
    assert.equal(loanPaymentUnavailableCopy(sampleLoan({ status: "active", currentPayoffAmount: 10 })), null);
  });

  it("hides the payment form for non-payable loans in the workspace", () => {
    const src = read("components/internal/workspace/loan-workspace-view.tsx");
    assert.match(src, /canAcceptLoanPayment\(loan\)/);
    assert.match(src, /loanPaymentUnavailableCopy/);
  });
});

describe("Release remediation — filter chip accessibility", () => {
  it("keeps navigation aria-current separate from filter aria-pressed", () => {
    const nav = read("components/internal/console/internal-nav.tsx");
    assert.match(nav, /aria-current=\{active \? "page" : undefined\}/);
    const chip = read("components/internal/console/ops-filter-chip.tsx");
    assert.match(chip, /aria-pressed=\{pressed\}/);
    assert.doesNotMatch(chip, /aria-current=/);
    const inbox = read("components/internal/inbox/inbox-page.tsx");
    assert.match(inbox, /aria-pressed=\{active\}/);
    assert.doesNotMatch(inbox, /aria-current=/);
    const activity = read("components/internal/workspace/record-activity-timeline.tsx");
    assert.match(activity, /aria-pressed=\{active === id\}/);
  });
});

describe("Release remediation — Terminal order search distinguishability", () => {
  it("distinguishes same-symbol NPT orders in search results", () => {
    const hits = searchUiLabTerminalOps("NPT").filter((r) => r.type === "terminal_order");
    assert.ok(hits.length >= 3);
    const sublabels = hits.map((h) => h.sublabel);
    assert.equal(new Set(sublabels).size, sublabels.length);
    for (const sub of sublabels) {
      assert.match(sub, /Open|Partially filled|Filled|Cancelled|Rejected/);
      assert.match(sub, /Ref /);
    }
    const rejected = hits.find((h) => /Rejected/.test(h.sublabel));
    assert.ok(rejected);
    assert.doesNotMatch(rejected!.sublabel, /Insufficient buying power/);
  });

  it("keeps the symbol as the scannable primary label", () => {
    const order = {
      side: "buy",
      type: "limit",
      status: "open",
      portfolioName: "Core Portfolio",
      investorLabel: "carter",
      submittedAt: "2026-07-20T12:00:00.000Z",
      filledQuantity: 0,
      quantity: 40,
      limitPrice: 42.5,
      id: "ui-lab-term-ord-open-1",
    } as Pick<
      TerminalOpsOrderRow,
      | "side"
      | "type"
      | "status"
      | "portfolioName"
      | "investorLabel"
      | "submittedAt"
      | "filledQuantity"
      | "quantity"
      | "limitPrice"
      | "id"
    >;
    const sub = formatTerminalOrderSearchSublabel(order);
    assert.match(sub, /Open/);
    assert.match(sub, /Limit 42\.5/);
    assert.doesNotMatch(sub, /^ui-lab-term-ord/);
  });
});

describe("Release remediation — Communications readiness copy", () => {
  it("separates credential status from draft readiness", () => {
    const src = read("components/internal/discord-embed-builder.tsx");
    assert.match(src, /Discord connected/);
    assert.match(src, /Preview only/);
    assert.match(src, /Needs information/);
    assert.match(src, /Ready to review/);
    assert.match(src, /Ready to send/);
    assert.match(src, /valid=\{validation\.valid\}/);
    assert.match(src, /window\.confirm\("Discard this draft/);
    // Credential badge must not claim Ready to send.
    assert.doesNotMatch(src, /configured \? "Ready to send"/);
  });
});

describe("Release remediation — Corporate Home statement signals", () => {
  it("deduplicates statement signals and title-cases labels", () => {
    const health: OpsHealthItem[] = [
      {
        key: "statements",
        label: "statements",
        status: "operational",
        detail: "Batch generation via Statements ops",
        lastSuccessAt: null,
      },
      {
        key: "BANK_ACCOUNT_STATEMENTS",
        label: "Bank account monthly statements",
        status: "operational",
        detail: "12 generated · period 2026-06-01 – 2026-06-30",
        lastSuccessAt: null,
      },
      {
        key: "scheduled_transfers",
        label: "scheduled_transfers",
        status: "degraded",
        detail: "2 failed",
        lastSuccessAt: null,
      },
    ];
    const deduped = dedupeHomePlatformSignals(health);
    assert.equal(deduped.filter((h) => /statement/i.test(h.label)).length, 1);
    assert.equal(formatHomePlatformSignalLabel("statements", "statements"), "Bank account statements");
    const selected = selectHomePlatformStatus(health);
    assert.equal(selected[0]?.key, "scheduled_transfers");
    assert.ok(selected.every((h) => h.label !== "statements"));
    assert.ok(selected.every((h) => !/^[a-z_]+$/.test(h.label)));
  });

  it("allows period copy to wrap on Corporate Home", () => {
    const src = read("routes/internal/index.tsx");
    assert.match(src, /break-words/);
    assert.doesNotMatch(src, /mt-1 truncate text-\[11px\] text-muted-foreground/);
  });
});

describe("Release remediation — failure copy", () => {
  it("avoids repeating Failed across transfer attention and lifecycle", () => {
    const life = buildTransferLifecycle({
      status: "failed",
      createdAt: "2026-01-01T00:00:00.000Z",
      nextRunAt: null,
      lastRunAt: "2026-01-02T00:00:00.000Z",
      lastFailureReason: "Insufficient available balance",
      lastExecutionStatus: "failed",
      lastExecutionStatusLabel: "Failed",
    });
    const failedStage = life.find((s) => s.id === "failed");
    assert.equal(failedStage?.label, "Execution stopped");
    assert.equal(transferAttentionLabel({ status: "failed", consecutiveFailures: 2 }), "Action needed");
    assert.match(
      transferAttentionCopy({
        status: "failed",
        consecutiveFailures: 2,
        lastFailureReason: "Insufficient available balance",
        statusLabel: "Failed",
      }) ?? "",
      /Insufficient available balance/,
    );
    assert.doesNotMatch(
      transferAttentionCopy({
        status: "failed",
        consecutiveFailures: 2,
        lastFailureReason: "Insufficient available balance",
        statusLabel: "Failed",
      }) ?? "",
      /^Failed/,
    );
  });
});

describe("Release remediation — restricted investor Inbox terminology", () => {
  it("presents investor access language instead of maintenance", () => {
    const src = read("routes/internal/terminal/inbox.tsx");
    assert.match(src, /Investor access/);
    assert.match(src, /Review investor/);
    assert.doesNotMatch(src, /\{item\.caseType\.replace/);
  });
});

describe("Release remediation — navigation integrity guardrails", () => {
  it("keeps UI Lab mutation gates and site-preserving helpers", () => {
    assert.match(read("lib/internal/ui-lab-mutation-gate.ts"), /useUiLabMutationGate/);
    assert.match(read("lib/internal/normalize-internal-search.ts"), /INTERNAL_SEARCH_KEY_PRIORITY/);
    const searchHref = parseInternalSearchHref(
      "/internal/users/x?tab=overview&section=notes&filter=all&from=%2Finternal%2Finbox",
      "bank",
    );
    assert.deepEqual(Object.keys(searchHref!.search), ["site", "tab", "section", "filter", "from"]);
  });
});
