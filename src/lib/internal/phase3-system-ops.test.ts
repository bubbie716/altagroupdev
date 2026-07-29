import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OpsJobRow } from "@/server/ops-jobs.service";
import {
  formatJobShortResult,
  jobsNeedingAttention,
  sortOpsJobs,
} from "@/lib/internal/ops-jobs-attention";
import {
  AUDIT_PAGE_SIZE,
  auditHasActiveFilters,
  groupConsecutiveAuditRows,
  isLowValueAuditAction,
} from "@/lib/internal/audit-presentation";
import { formatOpsAuditActionTitle } from "@/lib/internal/ops-activity-title";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import { partitionReportRows } from "@/lib/internal/ops-reports-presentation";
import type { OpsReportRow } from "@/lib/internal/ops-report.types";
import { buildActiveRiskSignals } from "@/lib/internal/risk-signals";
import { selectHomeRecentActivity } from "@/lib/internal/home-attention";
import type { ActivityFeedItem } from "@/lib/internal/ops-types";
import { maintenanceScopesForInternalSettings } from "@/lib/platform/maintenance-types";

const root = join(import.meta.dirname, "../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

function job(partial: Partial<OpsJobRow> & Pick<OpsJobRow, "jobKey" | "label">): OpsJobRow {
  return {
    description: "desc",
    cronEndpoint: null,
    lastRunAt: "2026-07-28T12:00:00.000Z",
    lastStatus: "SUCCESS",
    durationMs: 100,
    processedCount: 5,
    successCount: 5,
    failureCount: 0,
    nextScheduledRun: "Daily",
    latestError: null,
    detailSummary: "ok",
    manualRunKey: "scheduled_transfers",
    manualImpact: "impact",
    ...partial,
  };
}

function auditRow(partial: Partial<AuditLogRow> & Pick<AuditLogRow, "id" | "action">): AuditLogRow {
  return {
    actorUserId: "u1",
    actorUsername: "ops",
    targetUserId: null,
    targetUsername: null,
    targetAccountId: null,
    targetAccountNumber: null,
    targetAccountName: null,
    targetCompanyId: null,
    targetTransactionId: null,
    targetLoanId: null,
    entityType: "PLATFORM",
    entityId: null,
    description: "desc",
    metadata: null,
    createdAt: "2026-07-28T12:00:00.000Z",
    ...partial,
  };
}

describe("phase3: Jobs attention and sorting", () => {
  it("sorts failed jobs before healthy jobs", () => {
    const sorted = sortOpsJobs([
      job({ jobKey: "a", label: "Healthy A", lastStatus: "SUCCESS" }),
      job({ jobKey: "b", label: "Failed B", lastStatus: "FAILED", failureCount: 2 }),
      job({ jobKey: "c", label: "Unknown C", lastStatus: null }),
    ]);
    assert.equal(sorted[0]!.jobKey, "b");
    assert.equal(sorted[1]!.jobKey, "c");
    assert.equal(sorted[2]!.jobKey, "a");
  });

  it("lists only compact fields in the Jobs panel source", () => {
    const src = read("components/internal/jobs/internal-jobs-table.tsx");
    assert.match(src, />\s*Job\s*</);
    assert.match(src, />\s*Status\s*</);
    assert.match(src, />\s*Last run\s*</);
    assert.match(src, />\s*Next expected\s*</);
    assert.doesNotMatch(src, /Processed \/ OK \/ Failed/);
    assert.match(src, /Review job/);
    assert.match(src, /JobDetailsBody/);
    assert.match(src, /md:hidden/);
    // Manual run controls live in the details sheet, not every list row.
    const listSection = src.slice(src.indexOf("All jobs ({jobs.length})"), src.indexOf("<Sheet"));
    assert.doesNotMatch(listSection, /unavailableLabel\("Run"\)/);
    assert.doesNotMatch(listSection, /ManualRunControl/);
  });

  it("puts full operational data and one UI Lab gate in the details sheet", () => {
    const src = read("components/internal/jobs/internal-jobs-table.tsx");
    assert.match(src, /Duration/);
    assert.match(src, /Processed/);
    assert.match(src, /Succeeded/);
    assert.match(src, /Errors/);
    assert.match(src, /Latest error/);
    assert.match(src, /Manual job execution is unavailable in UI Lab/);
    assert.equal((src.match(/unavailableLabel\("Run"\)/g) ?? []).length, 1);
    assert.doesNotMatch(src, /Unavailable in UI Lab[\s\S]*Unavailable in UI Lab/);
  });

  it("flags failed and partial jobs for attention", () => {
    const attention = jobsNeedingAttention([
      job({ jobKey: "ok", label: "OK", lastStatus: "SUCCESS" }),
      job({
        jobKey: "bad",
        label: "Bad",
        lastStatus: "FAILED",
        latestError: "timeout",
      }),
      job({
        jobKey: "partial",
        label: "Partial",
        lastStatus: "SUCCESS",
        failureCount: 2,
        processedCount: 10,
        successCount: 8,
      }),
    ]);
    assert.equal(attention.some((a) => a.job.jobKey === "bad"), true);
    assert.equal(attention.some((a) => a.job.jobKey === "partial"), true);
    assert.equal(attention.some((a) => a.job.jobKey === "ok"), false);
    assert.equal(formatJobShortResult(job({ jobKey: "x", label: "X", failureCount: 7 })), "7 failed");
    assert.equal(formatJobShortResult(job({ jobKey: "y", label: "Y", successCount: 5 })), "5 succeeded");
  });
});

describe("phase3: Audit filters, humanization, grouping, pagination", () => {
  it("defaults to search/category/actor/date with advanced behind a control", () => {
    const src = read("routes/internal/audit.tsx");
    assert.match(src, /Event category/);
    assert.match(src, /label="Actor"/);
    assert.match(src, /Advanced filters/);
    assert.match(src, /Exact action code/);
    assert.match(src, /Meaningful events/);
    assert.match(src, /All events/);
    assert.match(src, /AUDIT_PAGE_SIZE/);
    assert.equal(AUDIT_PAGE_SIZE, 50);
    assert.equal(auditHasActiveFilters({}), false);
    assert.equal(auditHasActiveFilters({ q: "x" }), true);
  });

  it("humanizes titles while keeping raw codes available", () => {
    const table = read("components/internal/internal-audit-table.tsx");
    assert.match(table, /formatOpsAuditActionTitle/);
    assert.match(table, /Technical details/);
    assert.match(table, /Action code/);
    assert.equal(formatOpsAuditActionTitle("DEPOSIT_APPROVED"), "Deposit approved");
  });

  it("groups consecutive low-value repeated events", () => {
    assert.equal(isLowValueAuditAction("STAFF_AUDIT_MESSAGE_FAILED"), true);
    const rows = [
      auditRow({ id: "1", action: "STAFF_AUDIT_MESSAGE_FAILED", createdAt: "2026-07-28T12:03:00.000Z" }),
      auditRow({ id: "2", action: "STAFF_AUDIT_MESSAGE_FAILED", createdAt: "2026-07-28T12:02:00.000Z" }),
      auditRow({ id: "3", action: "STAFF_AUDIT_MESSAGE_FAILED", createdAt: "2026-07-28T12:01:00.000Z" }),
      auditRow({ id: "4", action: "DEPOSIT_APPROVED", createdAt: "2026-07-28T12:00:00.000Z" }),
    ];
    const grouped = groupConsecutiveAuditRows(rows);
    assert.equal(grouped.length, 2);
    assert.equal(grouped[0]!.kind, "group");
    if (grouped[0]!.kind === "group") assert.equal(grouped[0].count, 3);
    assert.equal(grouped[1]!.kind, "single");
  });

  it("preserves filters and site while paging", () => {
    const src = read("routes/internal/audit.tsx");
    assert.match(src, /withInternalSiteSearch/);
    assert.match(src, /offset/);
    assert.match(src, /Previous/);
    assert.match(src, /Next/);
    assert.match(src, /readDevSiteFromSearch/);
  });
});

describe("phase3: Reports simplification", () => {
  it("orders nonzero first and collapses zeros", () => {
    const reports: OpsReportRow[] = [
      { key: "a", label: "Deposits", count: 0, totalAmount: 0 },
      { key: "b", label: "Withdrawals", count: 3, totalAmount: 10 },
      { key: "c", label: "Transfers", count: 0, totalAmount: 0 },
    ];
    const { active, zero } = partitionReportRows(reports);
    assert.deepEqual(
      active.map((r) => r.key),
      ["b"],
    );
    assert.equal(zero.length, 2);
    const src = read("routes/internal/reports.tsx");
    assert.match(src, /Show.*no activity/);
    assert.match(src, /Review deposits/);
    assert.match(src, /View withdrawal transactions/);
    assert.match(src, /Review lending applications/);
    assert.match(src, /View Alta Pay activity/);
    assert.doesNotMatch(src, /label: "Queue"/);
    assert.doesNotMatch(src, />Queue</);
    assert.equal((src.match(/Export CSV/g) ?? []).length, 1);
    assert.doesNotMatch(src, /OpsCsvExportButton/);
  });
});

describe("phase3: Risk Signals", () => {
  it("hides zero cards and keeps the compliance route", () => {
    const signals = buildActiveRiskSignals(
      {
        frozenAccounts: 2,
        restrictedUsers: 0,
        frozenUsers: 0,
        failedScheduledTransfers: 1,
        deniedWithdrawalsLast30Days: 0,
        largeAdjustmentsLast30Days: 0,
      },
      "corporate",
    );
    assert.equal(signals.length, 2);
    assert.equal(
      buildActiveRiskSignals(
        {
          frozenAccounts: 0,
          restrictedUsers: 0,
          frozenUsers: 0,
          failedScheduledTransfers: 0,
          deniedWithdrawalsLast30Days: 0,
          largeAdjustmentsLast30Days: 0,
        },
        "bank",
      ).length,
      0,
    );
    const src = read("routes/internal/compliance.tsx");
    assert.match(src, /Risk Signals/);
    assert.match(src, /No active risk signals/);
    assert.doesNotMatch(src, /Compliance cases/);
    assert.match(src, /withInternalSiteSearch/);
    assert.match(src, /Investigations are managed through the relevant customer/);
  });
});

describe("phase3: Settings canonicalization and scopes", () => {
  it("redirects bank site settings to the bank settings route", () => {
    const src = read("routes/internal/settings.tsx");
    assert.match(src, /beforeLoad/);
    assert.match(src, /site === "bank"/);
    assert.match(src, /\/internal\/bank\/settings/);
    assert.doesNotMatch(src, /Operations status/);
  });

  it("keeps Bank scopes bank-only and Corporate broader", () => {
    assert.deepEqual(maintenanceScopesForInternalSettings("bank"), ["bank"]);
    assert.ok(maintenanceScopesForInternalSettings("corporate").includes("sitewide"));
    assert.ok(maintenanceScopesForInternalSettings("corporate").includes("terminal"));
    const bank = read("routes/internal/bank/settings.tsx");
    assert.match(bank, /maintenanceScopesForInternalSettings\("bank"\)/);
    const corp = read("routes/internal/settings.tsx");
    assert.match(corp, /maintenanceScopesForInternalSettings\("corporate"\)/);
    const panel = read("components/internal/maintenance-mode-panel.tsx");
    assert.match(panel, /Select a scope/);
    assert.match(panel, /aria-label="Maintenance scope"/);
  });
});

describe("phase3: Interest consolidation", () => {
  it("lists attention accounts once and keeps actions in a sheet", () => {
    const page = read("routes/internal/bank/interest.tsx");
    assert.match(page, /Accounts requiring attention/);
    assert.match(page, /Interest actions/);
    assert.match(page, /mode="actions"/);
    assert.equal((page.match(/due\.map/g) ?? []).length, 1);
    const ops = read("components/bank/internal-account-interest-ops.tsx");
    assert.match(ops, /mode\?: "full" \| "actions"/);
    assert.match(ops, /Manual interest accrual and preview are disabled in UI Lab/);
  });
});

describe("phase3: Corporate Home staff-alert grouping", () => {
  it("collapses repeated staff-alert delivery failures", () => {
    const activity: ActivityFeedItem[] = [
      {
        id: "1",
        category: "audit",
        title: "Staff alert delivery failed",
        detail: "d",
        accountLabel: null,
        accountId: null,
        href: "/internal/audit",
        actorLabel: "sys",
        createdAt: "2026-07-28T12:07:00.000Z",
      },
      {
        id: "2",
        category: "audit",
        title: "Staff alert delivery failed",
        detail: "d",
        accountLabel: null,
        accountId: null,
        href: "/internal/audit",
        actorLabel: "sys",
        createdAt: "2026-07-28T12:06:00.000Z",
      },
      {
        id: "3",
        category: "audit",
        title: "Deposit approved",
        detail: "d",
        accountLabel: null,
        accountId: null,
        href: null,
        actorLabel: "ops",
        createdAt: "2026-07-28T12:05:00.000Z",
      },
    ];
    // pad to seven total staff-alert failures (2 already present)
    for (let i = 4; i <= 8; i++) {
      activity.push({
        id: String(i),
        category: "audit",
        title: "Staff alert delivery failed",
        detail: "d",
        accountLabel: null,
        accountId: null,
        href: "/internal/audit",
        actorLabel: "sys",
        createdAt: `2026-07-28T11:${String(50 + i).padStart(2, "0")}:00.000Z`,
      });
    }
    const recent = selectHomeRecentActivity(activity, 6);
    const cluster = recent.find((r) => r.title.includes("staff alerts were not delivered"));
    assert.ok(cluster);
    assert.match(cluster!.title, /7 staff alerts were not delivered/);
    assert.equal(cluster!.search?.action, "STAFF_AUDIT_MESSAGE_FAILED");
    assert.equal(recent.filter((r) => r.title === "Staff alert delivery failed").length, 0);
  });
});

describe("phase3: Mobile layout contracts", () => {
  it("uses cards/compact layouts for Jobs, Reports, Risk, Audit advanced sheet", () => {
    assert.match(read("components/internal/jobs/internal-jobs-table.tsx"), /md:hidden/);
    assert.match(read("routes/internal/reports.tsx"), /grid gap-3 sm:grid-cols-2/);
    assert.match(read("routes/internal/compliance.tsx"), /grid gap-3 sm:grid-cols-2/);
    assert.match(read("routes/internal/audit.tsx"), /SheetContent/);
    assert.match(read("routes/internal/bank/interest.tsx"), /SheetContent/);
  });
});
