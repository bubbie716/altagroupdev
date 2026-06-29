"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import { florin } from "@/lib/bank/api";
import type { PrivateBankingQueueRow } from "@/lib/bank/alta-private-types";

function invitationLabel(row: PrivateBankingQueueRow): string {
  if (row.altaPrivateActive) return "Active membership";
  if (row.invitationStatus === "pending") return "Pending invitation";
  if (row.altaPrivateEligible) return "Eligible";
  if (row.invitationStatus === "declined") return "Declined";
  if (row.invitationStatus === "revoked") return "Revoked";
  if (row.invitationStatus === "expired") return "Expired";
  return "—";
}

export function PrivateBankingQueueView({ rows }: { rows: PrivateBankingQueueRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        u.discordUsername.toLowerCase().includes(q) ||
        u.discordId.includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, query]);

  const columns: OpsTableColumn<PrivateBankingQueueRow>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (u) => (
        <Link
          to="/internal/users/$userId"
          params={{ userId: u.userId }}
          search={{ tab: "relationship" }}
          className="font-mono text-[11px] hover:text-gold"
          onClick={(e) => e.stopPropagation()}
        >
          {u.discordUsername}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Alta Private",
      cell: (u) => <OpsStatusBadge status={invitationLabel(u)} dot={false} />,
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
      key: "sent",
      header: "Invitation sent",
      cell: (u) => (
        <span className="font-mono text-[11px]">
          {u.invitationSentAt ? formatQueueDate(u.invitationSentAt) : "—"}
        </span>
      ),
    },
    {
      key: "age",
      header: "Age",
      cell: (u) => <QueueAgeCell isoOrDate={u.createdAt} />,
      sortable: true,
    },
    {
      key: "action",
      header: "",
      cell: (u) => (
        <Link
          to="/internal/users/$userId"
          params={{ userId: u.userId }}
          search={{ tab: "relationship" }}
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
      title="Alta Private"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search customer, Discord ID…"
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(u) => u.userId}
        onRowClick={(u) =>
          void router.navigate({
            to: "/internal/users/$userId",
            params: { userId: u.userId },
            search: { tab: "relationship" },
          })
        }
        emptyState="No Alta Private queue entries match this filter."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} customer{filtered.length === 1 ? "" : "s"} · eligible, invited, active, or declined
          </span>
        }
      />
    </QueuePage>
  );
}
