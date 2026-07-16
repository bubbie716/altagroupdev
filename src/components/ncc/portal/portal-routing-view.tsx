"use client";

import type { PortalRoutingRow } from "@/lib/ncc/portal-types";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  PortalStatusBadge,
  formatPortalDate,
} from "@/components/ncc/portal/portal-status-badge";

export function PortalRoutingView({ rows }: { rows: PortalRoutingRow[] }) {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Network Identity"
        title="Routing Numbers"
        description="Institution routing numbers assigned by NCC. Administrative actions require elevated permissions."
        actions={
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-sm border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 text-[12px] font-medium text-[#9ca3af]"
            title="Available in a future sprint"
          >
            Request new
          </button>
        }
      />

      <PortalEnterpriseTable
        rows={rows}
        emptyTitle="No routing numbers"
        emptyDescription="Routing numbers appear once NCC assigns network identity to this institution."
        columns={[
          {
            key: "number",
            header: "Routing Number",
            render: (row) => (
              <span className="font-mono text-[13px] font-semibold tracking-wide">
                {row.routingNumber}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <PortalStatusBadge status={row.status} kind="routing" />,
          },
          {
            key: "primary",
            header: "Primary",
            render: (row) => (row.isPrimary ? "Yes" : "—"),
          },
          {
            key: "label",
            header: "Label",
            render: (row) => row.label ?? "—",
          },
          {
            key: "created",
            header: "Created",
            render: (row) => formatPortalDate(row.createdAt),
          },
          {
            key: "activated",
            header: "Activated",
            render: (row) => formatPortalDate(row.activatedAt),
          },
          {
            key: "retired",
            header: "Retired",
            render: (row) => formatPortalDate(row.deactivatedAt),
          },
          {
            key: "actions",
            header: "Actions",
            render: () => (
              <span className="text-[11px] text-[#9ca3af]">Suspend · Retire · Mark primary</span>
            ),
          },
        ]}
      />
    </div>
  );
}
