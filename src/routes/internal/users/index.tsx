import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { InternalUserFilters } from "@/components/internal/internal-user-filters";
import { formatAccountStatus, formatUserTag } from "@/lib/auth/tags";
import type { AccountStatus, UserTag } from "@/lib/auth/types";
import { fetchInternalUsers } from "@/lib/internal/user-management.functions";
import type { InternalUserListRow } from "@/lib/internal/user-management.types";

export type InternalUsersSearch = {
  q?: string;
  discordId?: string;
  tag?: UserTag;
  accountStatus?: AccountStatus;
};

export const Route = createFileRoute("/internal/users/")({
  validateSearch: (search: Record<string, unknown>): InternalUsersSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
    discordId:
      typeof search.discordId === "string" && search.discordId.trim()
        ? search.discordId.trim()
        : undefined,
    tag:
      search.tag === "admin" ||
      search.tag === "operator" ||
      search.tag === "private_client" ||
      search.tag === "developer" ||
      search.tag === "issuer"
        ? search.tag
        : undefined,
    accountStatus:
      search.accountStatus === "active" ||
      search.accountStatus === "restricted" ||
      search.accountStatus === "frozen" ||
      search.accountStatus === "pending_review"
        ? search.accountStatus
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchInternalUsers({ data: deps }),
  head: () => ({ meta: [{ title: "Users — Alta Internal" }] }),
  component: InternalUsers,
});

function InternalUsers() {
  const users = Route.useLoaderData();
  const search = Route.useSearch();

  const columns = [
    {
      key: "username",
      header: "Discord username",
      cell: (u: InternalUserListRow) => (
        <Link
          to="/internal/users/$userId"
          params={{ userId: u.id }}
          className="font-mono hover:text-gold"
        >
          {u.discordUsername}
        </Link>
      ),
    },
    {
      key: "discord",
      header: "Discord ID",
      cell: (u: InternalUserListRow) => (
        <span className="font-mono text-[11px] text-muted-foreground">{u.discordId}</span>
      ),
    },
    {
      key: "mc",
      header: "Minecraft",
      cell: (u: InternalUserListRow) =>
        u.minecraftUsername ? (
          <span className="font-mono text-[12px]">{u.minecraftUsername}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Account status",
      cell: (u: InternalUserListRow) => (
        <StatusBadge status={formatAccountStatus(u.accountStatus)} />
      ),
    },
    {
      key: "tags",
      header: "Current tags",
      cell: (u: InternalUserListRow) =>
        u.tags.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-mono text-[11px]">{u.tags.map(formatUserTag).join(", ")}</span>
        ),
    },
    {
      key: "companies",
      header: "Companies",
      cell: (u: InternalUserListRow) => (
        <span className="type-finance text-[12px]">{u.companyCount}</span>
      ),
    },
    {
      key: "accounts",
      header: "Bank accounts",
      cell: (u: InternalUserListRow) => (
        <span className="type-finance text-[12px]">{u.bankAccountCount}</span>
      ),
    },
    {
      key: "lastLogin",
      header: "Last login",
      cell: (u: InternalUserListRow) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {u.lastLoginAt.slice(0, 10)}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      cell: (u: InternalUserListRow) => (
        <span className="font-mono text-[11px] text-muted-foreground">
          {u.createdAt.slice(0, 10)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (u: InternalUserListRow) => (
        <Link
          to="/internal/users/$userId"
          params={{ userId: u.id }}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
        >
          Manage
        </Link>
      ),
    },
  ];

  return (
    <InternalPageShell
      title="User Management"
      description="Identity records, Alta access tags, and account status controls for Discord-authenticated users."
    >
      <InternalUserFilters search={search} />

      <Section title={`Users (${users.length}${users.length >= 200 ? "+" : ""})`}>
        {users.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No users match the current filters.</p>
        ) : (
          <AdminDataTable columns={columns} rows={users} rowKey={(u) => u.id} />
        )}
      </Section>
    </InternalPageShell>
  );
}
