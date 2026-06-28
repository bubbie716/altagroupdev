"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate } from "./queue-utils";
import { approveBankAccountOpening } from "@/lib/bank/bank.functions";
import type { InternalBankAccountRow } from "@/lib/bank/backend-types";

export function AccountOpeningsQueueView({
  pendingAccounts,
}: {
  pendingAccounts: InternalBankAccountRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pendingAccounts;
    return pendingAccounts.filter(
      (a) =>
        a.accountNumber.toLowerCase().includes(q) ||
        a.accountName.toLowerCase().includes(q) ||
        a.holder.toLowerCase().includes(q) ||
        a.product.toLowerCase().includes(q),
    );
  }, [pendingAccounts, query]);

  const columns: OpsTableColumn<InternalBankAccountRow>[] = [
    {
      key: "account",
      header: "Account",
      cell: (a) => <span className="font-mono text-[11px]">{a.accountNumber}</span>,
    },
    {
      key: "age",
      header: "Age",
      cell: (a) => <QueueAgeCell isoOrDate={a.createdAt} />,
      sortable: true,
    },
    {
      key: "created",
      header: "Requested",
      cell: (a) => <span className="font-mono text-[11px]">{formatQueueDate(a.createdAt)}</span>,
    },
    {
      key: "applicant",
      header: "Applicant",
      cell: (a) => <span className="text-[12px]">{a.holder}</span>,
    },
    {
      key: "name",
      header: "Account name",
      cell: (a) => a.accountName,
    },
    {
      key: "product",
      header: "Type",
      cell: (a) => <span className="text-[12px]">{a.product}</span>,
    },
    {
      key: "company",
      header: "Company",
      cell: (a) => a.companyName ?? "—",
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <OpsStatusBadge status={a.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (a) => (
        <OpsAction
          label="Approve"
          variant="primary"
          title="Approve account opening"
          description="This will activate the account and allow banking activity."
          impact={`${a.accountName} · ${a.accountNumber} · ${a.product}`}
          confirmLabel="Confirm approval"
          onConfirm={async (reason) => {
            await approveBankAccountOpening({ data: { accountId: a.id, reviewNote: reason } });
          }}
        />
      ),
    },
  ];

  return (
    <QueuePage
      title="Account Openings"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search account, applicant, product…"
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(a) => a.id}
        onRowClick={(a) =>
          void router.navigate({ to: "/internal/bank/accounts/$accountId", params: { accountId: a.id } })
        }
        emptyState="No pending account openings."
        filterSlot={
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {filtered.length} item{filtered.length === 1 ? "" : "s"}
          </span>
        }
      />
      <p className="mt-3 text-[11px] text-muted-foreground">
        Review full account context on the{" "}
        <Link to="/internal/bank/accounts" className="text-gold hover:underline">
          accounts explorer
        </Link>
        .
      </p>
    </QueuePage>
  );
}
