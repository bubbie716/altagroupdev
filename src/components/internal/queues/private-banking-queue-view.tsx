"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import { florin } from "@/lib/bank/api";
import { formatUserTag } from "@/lib/auth/tags";
import type { InternalUserListRow } from "@/lib/internal/user-management.types";

export function PrivateBankingQueueView({ users }: { users: InternalUserListRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const eligible = useMemo(
    () =>
      users.filter(
        (u) =>
          u.tags.includes("private_client") ||
          u.totalBankBalance >= 500_000 ||
          u.accountStatus === "pending_review",
      ),
    [users],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter(
      (u) =>
        u.discordUsername.toLowerCase().includes(q) ||
        u.discordId.includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false),
    );
  }, [eligible, query]);

  const columns: OpsTableColumn<InternalUserListRow>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (u) => (
        <Link
          to="/internal/users/$userId"
          params={{ userId: u.id }}
          className="font-mono text-[11px] hover:text-gold"
          onClick={(e) => e.stopPropagation()}
        >
          {u.discordUsername}
        </Link>
      ),
    },
    {
      key: "tags",
      header: "Tags",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.tags.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            u.tags.map((tag) => (
              <OpsStatusBadge key={tag} status={formatUserTag(tag)} dot={false} />
            ))
          )}
        </div>
      ),
    },
    {
      key: "assets",
      header: "Alta assets",
      cell: (u) => (
        <span className="type-finance tabular-nums">{florin(u.totalBankBalance)}</span>
      ),
    },
    {
      key: "accounts",
      header: "Accounts",
      cell: (u) => <span className="tabular-nums">{u.bankAccountCount}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => <OpsStatusBadge status={u.accountStatus.replace(/_/g, " ")} />,
    },
    {
      key: "age",
      header: "Age",
      cell: (u) => <QueueAgeCell isoOrDate={u.createdAt} />,
      sortable: true,
    },
    {
      key: "since",
      header: "Relationship since",
      cell: (u) => (
        <span className="font-mono text-[11px]">{formatQueueDate(u.createdAt)}</span>
      ),
    },
    {
      key: "action",
      header: "",
      cell: (u) => (
        <Link
          to="/internal/users/$userId"
          params={{ userId: u.id }}
          className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Workspace
        </Link>
      ),
    },
  ];

  return (
    <QueuePage
      title="Private Banking"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search customer, Discord ID…"
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(u) => u.id}
        onRowClick={(u) =>
          void router.navigate({ to: "/internal/users/$userId", params: { userId: u.id } })
        }
        emptyState="No private-eligible customers match this queue."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} customer{filtered.length === 1 ? "" : "s"} · private tag, high balance, or pending review
          </span>
        }
      />
    </QueuePage>
  );
}
