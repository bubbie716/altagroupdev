import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { formatCompanyRole } from "@/lib/internal/format";
import { formatUserTag } from "@/lib/auth/tags";
import { getInternalUsers } from "@/lib/internal/api";
import type { InternalUser } from "@/lib/internal/types";

export const Route = createFileRoute("/internal/users")({
  head: () => ({ meta: [{ title: "Users — Alta Internal" }] }),
  component: InternalUsers,
});

function InternalUsers() {
  const users = getInternalUsers();

  const columns = [
    { key: "username", header: "Username", cell: (u: InternalUser) => <span className="font-mono">{u.username}</span> },
    { key: "discord", header: "Discord ID", cell: (u: InternalUser) => <span className="font-mono text-[11px] text-muted-foreground">{u.discordId}</span> },
    { key: "mc", header: "Minecraft", cell: (u: InternalUser) => <span className="font-mono text-[12px]">{u.minecraftUsername}</span> },
    {
      key: "tags",
      header: "Tags",
      cell: (u: InternalUser) =>
        u.tags.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-mono text-[11px]">{u.tags.map(formatUserTag).join(", ")}</span>
        ),
    },
    {
      key: "companies",
      header: "Linked Companies",
      cell: (u: InternalUser) =>
        u.companyMemberships.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="text-[12px] leading-snug">
            {u.companyMemberships.map((m) => m.companyName).join(", ")}
          </span>
        ),
    },
    {
      key: "companyRoles",
      header: "Company Roles",
      cell: (u: InternalUser) =>
        u.companyMemberships.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-mono text-[11px]">
            {u.companyMemberships.map((m) => formatCompanyRole(m.role)).join(", ")}
          </span>
        ),
    },
    {
      key: "repStatus",
      header: "Rep. Status",
      cell: (u: InternalUser) => {
        if (u.companyMemberships.length === 0) return <StatusBadge status="None" />;
        const primary = u.companyMemberships[0].representativeStatus;
        return <StatusBadge status={primary} />;
      },
    },
    { key: "status", header: "Account", cell: (u: InternalUser) => <StatusBadge status={u.accountStatus} /> },
    { key: "active", header: "Last Active", cell: (u: InternalUser) => <span className="font-mono text-[11px] text-muted-foreground">{u.lastActive}</span> },
    {
      key: "actions",
      header: "Actions",
      cell: () => (
        <div className="flex flex-wrap gap-1">
          <MockActionButton label="View" />
          <MockActionButton label="Flag" />
          <MockActionButton label="Freeze" variant="danger" />
          <MockActionButton label="Promote" variant="primary" />
        </div>
      ),
    },
  ];

  return (
    <InternalPageShell
      title="User Management"
      description="Individual users authenticate via Discord (future). Company access is granted through authorized representative memberships."
    >
      <Section title="Users">
        <AdminDataTable columns={columns} rows={users} rowKey={(u) => u.id} />
      </Section>
    </InternalPageShell>
  );
}
