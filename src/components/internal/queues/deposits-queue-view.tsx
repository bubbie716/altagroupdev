"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsTable, type OpsTableColumn, type OpsTableSort } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { BankProofStatus } from "@/components/bank/bank-proof-link";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate, queueAgeMs } from "./queue-utils";
import { defaultQueueSortAccessor, sortQueueRows } from "./queue-table-sort";
import {
  approveBankDeposit,
  denyBankDeposit,
} from "@/lib/bank/bank.functions";
import { bulkApproveDepositsOps } from "@/lib/internal/ops-platform.functions";
import { bulkDenyDepositsOps } from "@/lib/internal/ops-v1.functions";
import type { InternalBankTransactionRow } from "@/lib/bank/backend-types";

export function DepositsQueueView({ pendingDeposits }: { pendingDeposits: InternalBankTransactionRow[] }) {
  const router = useRouter();
  const bulkApproveFn = useServerFn(bulkApproveDepositsOps);
  const bulkDenyFn = useServerFn(bulkDenyDepositsOps);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<OpsTableSort | null>({ key: "age", direction: "desc" });

  const filtered = useMemo(() => {
    let rows = pendingDeposits;
    if (statusFilter === "pending") {
      rows = rows.filter((r) => r.status.toLowerCase().includes("pending"));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.referenceCode.toLowerCase().includes(q) ||
          r.account.toLowerCase().includes(q) ||
          r.holder.toLowerCase().includes(q) ||
          r.amount.toLowerCase().includes(q),
      );
    }
    return sortQueueRows(rows, sort, (row, key) =>
      key === "age" ? queueAgeMs(row.submitted) : defaultQueueSortAccessor(row as Record<string, unknown>, key),
    );
  }, [pendingDeposits, query, statusFilter, sort]);

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
      key: "proof",
      header: "Proof",
      cell: (r) => (
        <BankProofStatus
          variant="internal"
          proofImageUrl={r.proofImageUrl}
          proofFileName={r.proofFileName}
          proofUploadedAt={r.proofUploadedAt}
          hasProof={r.hasProof}
        />
      ),
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
            title="Approve deposit"
            description="This will credit the selected account and mark the deposit request as approved."
            impact={`Amount ${r.amount} → account ${r.account}`}
            confirmLabel="Confirm approval"
            customerNotifies
            onConfirm={async (reason, options) => {
              await approveBankDeposit({
                data: { transactionId: r.id, reviewNote: reason, silentNotification: options?.silentNotification },
              });
              void router.invalidate();
            }}
          />
          <OpsAction
            label="Deny"
            variant="danger"
            title="Deny deposit"
            description="This will reject the deposit request. Funds will not be credited."
            impact={`Reference ${r.referenceCode} · ${r.amount}`}
            confirmLabel="Confirm denial"
            customerNotifies
            onConfirm={async (reason, options) => {
              await denyBankDeposit({
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
      title="Deposits"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search ref, account, customer, amount…"
      statusTabs={[
        { id: "all", label: "All", count: pendingDeposits.length },
        { id: "pending", label: "Pending", count: pendingDeposits.length },
      ]}
      activeStatus={statusFilter}
      onStatusChange={(id) => setStatusFilter(id as "all" | "pending")}
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
        emptyState="No pending deposits."
        bulkActions={
          <>
            <OpsAction
              label="Bulk approve"
              variant="primary"
              title="Bulk approve deposits"
              description={`Approve ${selected.size} selected deposit(s). Each approval posts to the ledger.`}
              impact={
                selected.size > 0 ? (
                  <>
                    <strong>{selected.size}</strong> deposits · estimated total{" "}
                    <span className="type-finance">ƒ{selectedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </>
                ) : null
              }
              confirmLabel="Approve all selected"
              disabled={selected.size === 0}
              onConfirm={async (reason) => {
                const result = await bulkApproveFn({ data: { transactionIds: [...selected], reviewNote: reason } });
                setSelected(new Set());
                void router.invalidate();
                return result;
              }}
            />
            <OpsAction
              label="Bulk deny"
              variant="danger"
              title="Bulk deny deposits"
              description={`Deny ${selected.size} selected deposit(s). Required reason is recorded in audit.`}
              impact={`${selected.size} deposit(s) will be rejected`}
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
              filename="deposits-queue.csv"
              headers={["reference", "age", "created", "customer", "account", "amount", "status"]}
              getRows={() =>
                filtered.map((r) => [
                  r.referenceCode,
                  r.submitted,
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
