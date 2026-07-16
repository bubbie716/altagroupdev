"use client";

import { Link } from "@tanstack/react-router";
import type {
  PortalAlert,
  PortalAuditRow,
  PortalDashboardMetrics,
  PortalSettlementRow,
} from "@/lib/ncc/portal-types";
import { PortalMetricCard, PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  PortalStatusBadge,
  formatDurationMs,
  formatPortalDate,
  formatPortalMoney,
} from "@/components/ncc/portal/portal-status-badge";

export function PortalDashboardView({
  metrics,
  alerts,
  recentSettlements,
  recentAudit,
}: {
  metrics: PortalDashboardMetrics;
  alerts: PortalAlert[];
  recentSettlements: PortalSettlementRow[];
  recentAudit: PortalAuditRow[];
}) {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Institution Portal"
        title="Dashboard"
        description="Operational summary for clearing, settlement, and institution controls."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/portal/queue"
              search={{ status: undefined, q: undefined }}
              className="rounded-sm border border-[#0c4d32] bg-[#0c4d32] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#0a3f29]"
            >
              Open exceptions
            </Link>
            <Link
              to="/portal/reports"
              className="rounded-sm border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]"
            >
              Reports
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard
          label="Institution Status"
          value={metrics.institution.status}
          hint={metrics.institution.displayName}
        />
        <PortalMetricCard
          label="Primary Routing"
          value={metrics.primaryRoutingNumber ?? "—"}
        />
        <PortalMetricCard
          label="Settlement Balance"
          value={formatPortalMoney(metrics.settlementBalance, metrics.currency)}
          hint={`Available ${formatPortalMoney(metrics.settlementAvailable, metrics.currency)}`}
        />
        <PortalMetricCard
          label="Today's Volume"
          value={formatPortalMoney(metrics.todayVolume, metrics.currency)}
          hint={`${metrics.todayCount} settled today`}
        />
        <PortalMetricCard label="Pending Queue" value={String(metrics.pendingCount)} />
        <PortalMetricCard label="Failed Settlements" value={String(metrics.failedCount)} />
        <PortalMetricCard
          label="Avg Settlement Time"
          value={formatDurationMs(metrics.averageSettlementMs)}
        />
        <PortalMetricCard label="Active Members" value={String(metrics.memberCount)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Operational Alerts
          </h2>
          {alerts.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#6b7280]">No active operational alerts.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <Link
                    to={(alert.href ?? "/portal") as "/portal"}
                    className="flex items-start gap-3 rounded-sm border border-[#f3f4f6] px-3 py-2.5 hover:bg-[#f9fafb]"
                  >
                    <PortalStatusBadge status={alert.severity} kind="severity" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#111827]">{alert.title}</div>
                      <div className="text-[12px] text-[#6b7280]">{alert.detail}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
            Quick Actions
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { to: "/portal/queue", label: "Processing & exceptions" },
              { to: "/portal/settlements", label: "Settlement history" },
              { to: "/portal/accounts", label: "Settlement accounts" },
              { to: "/portal/routing", label: "Routing numbers" },
              { to: "/portal/members", label: "Institution members" },
              { to: "/portal/audit", label: "Audit log" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-sm border border-[#e5e7eb] px-3 py-2 text-[12px] font-medium text-[#374151] hover:border-[#0c4d32]/30 hover:bg-[#e8f2ed] hover:text-[#0c4d32]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Recent Settlement Activity
            </h2>
            <Link
              to="/portal/settlements"
              search={{ status: undefined, q: undefined }}
              className="text-[12px] font-medium text-[#0c4d32]"
            >
              View all
            </Link>
          </div>
          <PortalEnterpriseTable
            rows={recentSettlements}
            emptyTitle="No recent settlements"
            emptyDescription="Settlement activity for this institution will appear here."
            columns={[
              {
                key: "ref",
                header: "Reference",
                render: (row) => (
                  <Link
                    to="/portal/settlements/$id"
                    params={{ id: row.id }}
                    className="font-medium text-[#0c4d32] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.publicReference}
                  </Link>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => <PortalStatusBadge status={row.status} kind="settlement" />,
              },
              {
                key: "amount",
                header: "Amount",
                className: "tabular-nums",
                render: (row) => formatPortalMoney(row.amount, row.currency),
              },
              {
                key: "counterparties",
                header: "Flow",
                render: (row) => (
                  <span className="text-[#4b5563]">
                    {row.sendingInstitutionName} → {row.receivingInstitutionName}
                  </span>
                ),
              },
              {
                key: "submitted",
                header: "Submitted",
                render: (row) => formatPortalDate(row.submittedAt ?? row.createdAt),
              },
            ]}
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
              Recent Audit Events
            </h2>
            <Link to="/portal/audit" search={{ q: undefined }} className="text-[12px] font-medium text-[#0c4d32]">
              View all
            </Link>
          </div>
          <PortalEnterpriseTable
            rows={recentAudit}
            emptyTitle="No audit events"
            emptyDescription="Institution audit activity will appear here."
            columns={[
              {
                key: "time",
                header: "Time",
                render: (row) => formatPortalDate(row.createdAt),
              },
              {
                key: "actor",
                header: "Actor",
                render: (row) => row.actorUsername,
              },
              {
                key: "action",
                header: "Action",
                render: (row) => row.action.replace(/^NCC_/, ""),
              },
              {
                key: "desc",
                header: "Detail",
                render: (row) => <span className="line-clamp-1 text-[#4b5563]">{row.description}</span>,
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
