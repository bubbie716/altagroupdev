"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsTable, type OpsTableColumn, type OpsTableSort } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate, queueAgeMs } from "./queue-utils";
import { defaultQueueSortAccessor, sortQueueRows } from "./queue-table-sort";
import {
  approveBankWithdrawal,
  denyBankWithdrawal,
} from "@/lib/bank/bank.functions";
import { bulkApproveWithdrawalsOps } from "@/lib/internal/ops-platform.functions";
import { bulkDenyWithdrawalsOps } from "@/lib/internal/ops-v1.functions";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

export function WithdrawalsQueueView({
  pendingWithdrawals,
}: {
  pendingWithdrawals: InternalBankTransactionRow[];
}) {
  const router = useRouter();
  const bulkApproveFn = useServerFn(bulkApproveWithdrawalsOps);
  const bulkDenyFn = useServerFn(bulkDenyWithdrawalsOps);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<OpsTableSort | null>({ key: "age", direction: "desc" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = pendingWithdrawals;
    if (q) {
      rows = rows.filter(
        (r) =>
          r.referenceCode.toLowerCase().includes(q) ||
          r.account.toLowerCase().includes(q) ||
          r.holder.toLowerCase().includes(q),
      );
    }
    return sortQueueRows(rows, sort, (row, key) =>
      key === "age" ? queueAgeMs(row.submitted) : defaultQueueSortAccessor(row as Record<string, unknown>, key),
    );
  }, [pendingWithdrawals, query, sort]);

  const columns: OpsTableColumn<InternalBankTransactionRow>[] = [
    {
      key: "ref",
      header: "Ref",
      cell: (r) => <span className="font-mono text-[11px]">{r.referenceCode}</span>,
      sortable: true,
    },
    {
      key: "age",
      header: "Age",
      cell: (r) => <QueueAgeCell isoOrDate={r.submitted} />,
      sortable: true,
    },
    {
      key: "submitted",
      header: "Created",
      cell: (r) => <span className="font-mono text-[11px]">{formatQueueDate(r.submitted)}</span>,
      sortable: true,
    },
    {
      key: "holder",
      header: "Customer",
      cell: (r) => <span className="text-[12px]">{r.holder}</span>,
    },
    {
      key: "account",
      header: "Account",
      cell: (r) => (
        <Link
          to="/internal/bank/accounts"
          search={{ q: r.account }}
          className="font-mono text-[11px] text-gold hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {r.account}
        </Link>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => <span className="type-finance tabular-nums">{r.amount}</span>,
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <OpsStatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          <OpsAction
            label="Approve"
            variant="primary"
            title="Approve withdrawal"
            description="This will debit the account and mark the withdrawal as approved for settlement."
            impact={`Amount ${r.amount} from account ${r.account}`}
            confirmLabel="Confirm approval"
            customerNotifies
            onConfirm={async (reason, options) => {
              await approveBankWithdrawal({
                data: { transactionId: r.id, reviewNote: reason, silentNotification: options?.silentNotification },
              });
              void router.invalidate();
            }}
          />
          <OpsAction
            label="Deny"
            variant="danger"
            title="Deny withdrawal"
            description="This will reject the withdrawal request. No funds will leave the account."
            confirmLabel="Confirm denial"
            customerNotifies
            onConfirm={async (reason, options) => {
              await denyBankWithdrawal({
                data: { transactionId: r.id, reviewNote: reason, silentNotification: options?.silentNotification },
              });
              void router.invalidate();
            }}
          />
        </div>
      ),
    },
  ];

  const selectedTotal = filtered
    .filter((r) => selected.has(r.id))
    .reduce((sum, r) => sum + parseAmount(r.amount), 0);

  return (
    <QueuePage
      title="Withdrawals"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search ref, account, customer…"
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
        selectable
        selectedIds={selected}
        onSelectionChange={setSelected}
        onRowClick={(r) =>
          void router.navigate({ to: "/internal/bank/transactions/$transactionId", params: { transactionId: r.id } })
        }
        emptyState="No pending withdrawals."
        bulkActions={
          <>
            <OpsAction
              label="Bulk approve"
              variant="primary"
              title="Bulk approve withdrawals"
              description={`Approve ${selected.size} selected withdrawal(s).`}
              impact={
                <>
                  {selected.size} withdrawals · total{" "}
                  <span className="type-finance">
                    ƒ{selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </>
              }
              confirmLabel="Approve all selected"
              disabled={selected.size === 0}
              onConfirm={async (reason) => {
                await bulkApproveFn({ data: { transactionIds: [...selected], reviewNote: reason } });
                setSelected(new Set());
                void router.invalidate();
              }}
            />
            <OpsAction
              label="Bulk deny"
              variant="danger"
              title="Bulk deny withdrawals"
              description={`Deny ${selected.size} selected withdrawal(s).`}
              impact={`${selected.size} withdrawal(s) will be rejected`}
              confirmLabel="Deny all selected"
              disabled={selected.size === 0}
              onConfirm={async (reason) => {
                await bulkDenyFn({ data: { transactionIds: [...selected], reviewNote: reason } });
                setSelected(new Set());
                void router.invalidate();
              }}
            />
          </>
        }
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </span>
            <OpsCsvExportButton
              filename="withdrawals-queue.csv"
              headers={["reference", "created", "customer", "account", "amount", "status"]}
              getRows={() =>
                filtered.map((r) => [
                  r.referenceCode,
                  formatQueueDate(r.submitted),
                  r.holder,
                  r.account,
                  r.amount,
                  r.status,
                ])
              }
            />
          </div>
        }
      />
    </QueuePage>
  );
}

function parseAmount(formatted: string): number {
  const n = Number(formatted.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
