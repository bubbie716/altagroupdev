"use client";

import type { PortalMemberRow } from "@/lib/ncc/portal-types";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import {
  PortalStatusBadge,
  formatPortalDate,
} from "@/components/ncc/portal/portal-status-badge";

const ROLE_LABELS: Record<string, string> = {
  INSTITUTION_OWNER: "Owner",
  INSTITUTION_ADMIN: "Admin",
  SETTLEMENT_MANAGER: "Settlement Manager",
  SETTLEMENT_OPERATOR: "Settlement Operator",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};

export function PortalMembersView({ rows }: { rows: PortalMemberRow[] }) {
  return (
    <div>
      <PortalPageHeader
        eyebrow="Access Control"
        title="Institution Members"
        description="Users authorized to operate this institution in the NCC portal. Invite and role changes enforce server-side permissions."
        actions={
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-sm border border-[#e5e7eb] bg-[#f9fafb] px-3 py-1.5 text-[12px] font-medium text-[#9ca3af]"
            title="Available when invitation workflow ships"
          >
            Invite member
          </button>
        }
      />

      <PortalEnterpriseTable
        rows={rows}
        emptyTitle="No members"
        emptyDescription="Institution members will appear once access is granted."
        columns={[
          {
            key: "user",
            header: "User",
            render: (row) => <span className="font-medium">{row.username}</span>,
          },
          {
            key: "role",
            header: "Role",
            render: (row) => ROLE_LABELS[row.role] ?? row.role,
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <PortalStatusBadge status={row.status} kind="member" />,
          },
          {
            key: "added",
            header: "Added",
            render: (row) => formatPortalDate(row.createdAt),
          },
          {
            key: "last",
            header: "Last active",
            render: () => "—",
          },
          {
            key: "permissions",
            header: "Permissions",
            render: (row) => (
              <span className="text-[11px] text-[#6b7280]">
                Role-based · {ROLE_LABELS[row.role] ?? row.role}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: () => (
              <span className="text-[11px] text-[#9ca3af]">Role change · Remove</span>
            ),
          },
        ]}
      />
    </div>
  );
}
