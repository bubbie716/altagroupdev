"use client";

import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { PortalSettlementRow } from "@/lib/ncc/portal-types";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  PortalStatusBadge,
  formatPortalDate,
  formatPortalMoney,
} from "@/components/ncc/portal/portal-status-badge";

const STATUS_OPTIONS = [
  "CREATED",
  "SUBMITTED",
  "VALIDATING",
  "QUEUED",
  "SETTLING",
  "SETTLED",
  "FAILED",
  "CANCELLED",
  "REVERSED",
] as const;

export function PortalSettlementsView({
  rows,
  title,
  description,
  queueMode = false,
  onFilterChange,
}: {
  rows: PortalSettlementRow[];
  title: string;
  description: string;
  queueMode?: boolean;
  onFilterChange?: (filters: { q: string; status: string }) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (!q.trim()) return true;
      const hay = `${row.publicReference} ${row.sendingInstitutionName} ${row.receivingInstitutionName}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [rows, q, status]);

  const expanded = filtered.find((row) => row.id === expandedId) ?? null;

  return (
    <div>
      <PortalPageHeader eyebrow="Settlements" title={title} description={description} />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(event) => {
            const next = event.target.value;
            setQ(next);
            onFilterChange?.({ q: next, status });
          }}
          placeholder="Search reference or institution"
          className="h-9 w-full max-w-xs rounded-sm border border-[#e5e7eb] bg-white px-3 text-[13px] outline-none focus:border-[#0c4d32]/40"
          aria-label="Search settlements"
        />
        <select
          value={status}
          onChange={(event) => {
            const next = event.target.value;
            setStatus(next);
            onFilterChange?.({ q, status: next });
          }}
          className="h-9 rounded-sm border border-[#e5e7eb] bg-white px-3 text-[13px] outline-none focus:border-[#0c4d32]/40"
          aria-label="Filter by status"
        >
          <option value="">{queueMode ? "All queue statuses" : "All statuses"}</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <PortalEnterpriseTable
        rows={filtered}
        emptyTitle={queueMode ? "Queue is clear" : "No settlements"}
        emptyDescription={
          queueMode
            ? "There are no pending or failed instructions requiring attention."
            : "Settlement history for this institution will appear here."
        }
        onRowClick={(row) => setExpandedId((current) => (current === row.id ? null : row.id))}
        columns={[
          {
            key: "ref",
            header: "Reference",
            render: (row) => <span className="font-medium text-[#111827]">{row.publicReference}</span>,
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <PortalStatusBadge status={row.status} kind="settlement" />,
          },
          {
            key: "from",
            header: "Sending Institution",
            render: (row) => row.sendingInstitutionName,
          },
          {
            key: "to",
            header: "Receiving Institution",
            render: (row) => row.receivingInstitutionName,
          },
          {
            key: "amount",
            header: "Amount",
            className: "tabular-nums",
            render: (row) => formatPortalMoney(row.amount, row.currency),
          },
          {
            key: "currency",
            header: "Currency",
            render: (row) => row.currency,
          },
          {
            key: "submitted",
            header: "Submitted",
            render: (row) => formatPortalDate(row.submittedAt ?? row.createdAt),
          },
          {
            key: "stage",
            header: "Current Stage",
            render: (row) => row.executionStatus ?? row.stage,
          },
          {
            key: "nccSettled",
            header: "NCC Ledger",
            render: (row) => formatPortalDate(row.settledAt),
          },
          {
            key: "e2e",
            header: "E2E Complete",
            render: (row) => formatPortalDate(row.completedAt),
          },
          {
            key: "priority",
            header: "Priority",
            render: (row) => (row.status === "FAILED" ? "High" : "Normal"),
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <Link
                to="/portal/settlements/$id"
                params={{ id: row.id }}
                className="text-[12px] font-medium text-[#0c4d32] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View
              </Link>
            ),
          },
        ]}
      />

      {expanded ? (
        <div className="mt-4 rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">
                Details panel
              </div>
              <div className="mt-1 text-[15px] font-semibold text-[#111827]">
                {expanded.publicReference}
              </div>
            </div>
            <button
              type="button"
              className="rounded-sm border border-[#e5e7eb] px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#f9fafb]"
              onClick={() =>
                void navigate({ to: "/portal/settlements/$id", params: { id: expanded.id } })
              }
            >
              Open full detail
            </button>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[12px]">
            <div>
              <dt className="text-[#6b7280]">Status</dt>
              <dd className="mt-1">
                <PortalStatusBadge status={expanded.status} kind="settlement" />
              </dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Amount</dt>
              <dd className="mt-1 tabular-nums font-medium">
                {formatPortalMoney(expanded.amount, expanded.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[#6b7280]">Stage</dt>
              <dd className="mt-1">{expanded.stage}</dd>
            </div>
            {expanded.failureReason ? (
              <div className="sm:col-span-2">
                <dt className="text-[#6b7280]">Failure</dt>
                <dd className="mt-1 text-[#b91c1c]">
                  {expanded.failureCode ? `${expanded.failureCode}: ` : ""}
                  {expanded.failureReason}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
