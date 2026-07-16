"use client";

import { lazy, Suspense } from "react";
import type { PortalReportMetrics } from "@/lib/ncc/portal-types";
import { PortalMetricCard, PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  formatDurationMs,
  formatPortalMoney,
} from "@/components/ncc/portal/portal-status-badge";
import { SkeletonChart } from "@/components/ui/skeleton";

const PortalVolumeChart = lazy(() => import("@/components/ncc/portal/portal-volume-chart"));

function exportReportsCsv(metrics: PortalReportMetrics) {
  const lines = [
    "date,volume,count",
    ...metrics.dailyVolume.map((row) => `${row.date},${row.volume},${row.count}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ncc-settlement-reports.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PortalReportsView({ metrics }: { metrics: PortalReportMetrics }) {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Analytics"
        title="Reports"
        description="Settlement volume, failure rate, balances, and counterparty activity for the trailing 30 days."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportReportsCsv(metrics)}
              className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]"
            >
              Export CSV
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-sm border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 text-[12px] font-medium text-[#9ca3af]"
              title="PDF export planned"
            >
              Export PDF
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard
          label="Settlement volume"
          value={formatPortalMoney(metrics.settlementVolume)}
        />
        <PortalMetricCard label="Settlement count" value={String(metrics.settlementCount)} />
        <PortalMetricCard
          label="Failure rate"
          value={`${(metrics.failureRate * 100).toFixed(1)}%`}
        />
        <PortalMetricCard
          label="Avg processing time"
          value={formatDurationMs(metrics.averageProcessingMs)}
        />
      </div>

      <section className="mt-6 rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
          Daily volume
        </h2>
        <div className="mt-3 h-56">
          <Suspense fallback={<SkeletonChart height={224} />}>
            <PortalVolumeChart data={metrics.dailyVolume} />
          </Suspense>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Institution balances
          </h2>
          <PortalEnterpriseTable
            rows={metrics.balances.map((row, index) => ({
              id: `${row.currency}-${index}`,
              ...row,
            }))}
            emptyTitle="No balances"
            emptyDescription="Settlement account balances will appear here."
            columns={[
              {
                key: "currency",
                header: "Currency",
                render: (row) => row.currency,
              },
              {
                key: "ledger",
                header: "Ledger",
                className: "tabular-nums",
                render: (row) => formatPortalMoney(row.ledgerBalance, row.currency),
              },
              {
                key: "available",
                header: "Available",
                className: "tabular-nums",
                render: (row) => formatPortalMoney(row.availableBalance, row.currency),
              },
            ]}
          />
        </section>

        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Top counterparties
          </h2>
          <PortalEnterpriseTable
            rows={metrics.topCounterparties.map((row) => ({
              id: row.institutionId,
              ...row,
            }))}
            emptyTitle="No counterparties"
            emptyDescription="Settled counterparty volume will appear here."
            columns={[
              {
                key: "name",
                header: "Institution",
                render: (row) => row.name,
              },
              {
                key: "volume",
                header: "Volume",
                className: "tabular-nums",
                render: (row) => formatPortalMoney(row.volume),
              },
              {
                key: "count",
                header: "Count",
                className: "tabular-nums",
                render: (row) => String(row.count),
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
