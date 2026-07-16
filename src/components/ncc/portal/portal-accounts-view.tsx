"use client";

import type { PortalAccountSummary } from "@/lib/ncc/portal-types";
import { PortalMetricCard, PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  formatPortalDate,
  formatPortalMoney,
} from "@/components/ncc/portal/portal-status-badge";

function exportCsv(account: PortalAccountSummary) {
  const header = ["id", "entryType", "amount", "balanceAfter", "createdAt", "publicReference"];
  const lines = account.recentEntries.map((entry) =>
    [
      entry.id,
      entry.entryType,
      entry.amount,
      entry.balanceAfter,
      entry.createdAt,
      entry.publicReference,
    ].join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `settlement-account-${account.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PortalAccountsView({ account }: { account: PortalAccountSummary | null }) {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Settlement Accounts"
        title="Settlement Accounts"
        description="Institution settlement balances and ledger history. Manual balance editing is not permitted."
        actions={
          account ? (
            <button
              type="button"
              onClick={() => exportCsv(account)}
              className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]"
            >
              Export CSV
            </button>
          ) : null
        }
      />

      {!account ? (
        <div className="rounded-sm border border-dashed border-[#e5e7eb] bg-white px-6 py-12 text-center">
          <div className="text-[13px] font-semibold text-[#111827]">No settlement account</div>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            A settlement account is provisioned when the institution is approved for NCC participation.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PortalMetricCard
              label="Current balance"
              value={formatPortalMoney(account.ledgerBalance, account.currency)}
            />
            <PortalMetricCard
              label="Available balance"
              value={formatPortalMoney(account.availableBalance, account.currency)}
            />
            <PortalMetricCard
              label="Reserved balance"
              value={formatPortalMoney(account.reservedBalance, account.currency)}
              hint="Future-ready"
            />
            <PortalMetricCard
              label="Daily net movement"
              value={formatPortalMoney(account.dailyNetMovement, account.currency)}
              hint={`Status: ${account.status}`}
            />
          </div>

          <section className="mt-6">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Recent ledger entries
            </h2>
            <PortalEnterpriseTable
              rows={account.recentEntries}
              emptyTitle="No ledger entries"
              emptyDescription="Settlement account movements will appear here."
              columns={[
                {
                  key: "ref",
                  header: "Reference",
                  render: (row) => row.publicReference,
                },
                {
                  key: "type",
                  header: "Type",
                  render: (row) => row.entryType,
                },
                {
                  key: "amount",
                  header: "Amount",
                  className: "tabular-nums",
                  render: (row) => formatPortalMoney(row.amount, account.currency),
                },
                {
                  key: "after",
                  header: "Balance after",
                  className: "tabular-nums",
                  render: (row) => formatPortalMoney(row.balanceAfter, account.currency),
                },
                {
                  key: "time",
                  header: "Posted",
                  render: (row) => formatPortalDate(row.createdAt),
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
