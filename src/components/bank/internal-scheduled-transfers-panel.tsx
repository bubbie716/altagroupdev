"use client";

import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useRouter } from "@tanstack/react-router";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { florin } from "@/lib/bank/api";
import type { ExecuteDueScheduledTransfersResult } from "@/lib/bank/scheduled-transfer-executor";
import type { ExecuteDuePayrollRunsResult } from "@/lib/bank/payroll-executor";
import type { InternalScheduledTransferRow } from "@/lib/bank/scheduled-transfer-admin-types";
import {
  cancelInternalScheduledTransferRecord,
  pauseInternalScheduledTransferRecord,
  resumeInternalScheduledTransferRecord,
  runDueScheduledTransfersManual,
  runInternalScheduledTransferNowRecord,
} from "@/lib/bank/scheduled-transfer-admin.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";

function formatRunAt(value: string | null): string {
  if (!value) return "—";
  return formatActivityDateTime(value);
}

function RunDueTransfersButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    scheduledTransfers: ExecuteDueScheduledTransfersResult;
    payroll: ExecuteDuePayrollRunsResult;
  } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-border bg-background px-3 py-2 text-[12px] uppercase tracking-[0.12em] hover:bg-surface-2 disabled:opacity-50"
        onClick={async () => {
          setPending(true);
          try {
            const summary = await runDueScheduledTransfersManual();
            setResult(summary);
            await router.invalidate();
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? SUBMITTING_COPY.running : "Run Due Transfers & Payroll"}
      </button>
      {result ? (
        <p className="text-[12px] text-muted-foreground">
          Transfers: executed {result.scheduledTransfers.executedCount} · failed{" "}
          {result.scheduledTransfers.failedCount} · skipped {result.scheduledTransfers.skippedCount}
          {" · "}
          Payroll: executed {result.payroll.executedCount} · failed {result.payroll.failedCount} · skipped{" "}
          {result.payroll.skippedCount}
        </p>
      ) : null}
    </div>
  );
}

function ScheduledTransferActions({ row }: { row: InternalScheduledTransferRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function act(fn: () => Promise<unknown>) {
    setPending(true);
    try {
      await fn();
      await router.invalidate();
    } finally {
      setPending(false);
    }
  }

  const canPause = row.status === "approved";
  const canResume = row.status === "paused";
  const canCancel = ["approved", "paused", "pending_review"].includes(row.status);
  const canRunNow = ["approved", "paused"].includes(row.status);

  return (
    <div className="flex flex-wrap gap-1">
      {canPause ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-border bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
          onClick={() => act(() => pauseInternalScheduledTransferRecord({ data: row.id }))}
        >
          Pause
        </button>
      ) : null}
      {canResume ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-border bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
          onClick={() => act(() => resumeInternalScheduledTransferRecord({ data: row.id }))}
        >
          Resume
        </button>
      ) : null}
      {canRunNow ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-gold/30 bg-gold/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
          onClick={() => act(() => runInternalScheduledTransferNowRecord({ data: row.id }))}
        >
          Run now
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          disabled={pending}
          className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive disabled:opacity-50"
          onClick={() => act(() => cancelInternalScheduledTransferRecord({ data: row.id }))}
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}

export function InternalScheduledTransfersPanel({
  transfers,
  showRunButton = true,
}: {
  transfers: InternalScheduledTransferRow[];
  showRunButton?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showRunButton ? <RunDueTransfersButton /> : null}
      <AdminDataTable
        columns={[
          { key: "label", header: "Label", cell: (r) => r.label },
          {
            key: "owner",
            header: "Owner",
            cell: (r) => (
              <span className="text-[12px]">
                {r.ownerLabel}
                <span className="ml-1 text-muted-foreground">({r.ownerType})</span>
              </span>
            ),
          },
          {
            key: "source",
            header: "Source",
            cell: (r) => (
              <span className="font-mono text-[11px]">
                {r.sourceAccountName} · {r.sourceAccountNumber}
              </span>
            ),
          },
          {
            key: "dest",
            header: "Destination",
            cell: (r) => (
              <span className="text-[12px]">
                {r.destinationName}
                {r.destinationAccountNumber ? (
                  <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                    {r.destinationAccountNumber}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "amount",
            header: "Amount",
            cell: (r) => <span className="tabular-nums font-mono">{florin(r.amount)}</span>,
          },
          { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { key: "next", header: "Next run", cell: (r) => formatRunAt(r.nextRunAt) },
          { key: "last", header: "Last run", cell: (r) => formatRunAt(r.lastRunAt) },
          {
            key: "failures",
            header: "Failures",
            cell: (r) => (
              <span className="tabular-nums">{r.consecutiveFailures > 0 ? r.consecutiveFailures : "—"}</span>
            ),
          },
          {
            key: "reason",
            header: "Last failure",
            cell: (r) => (
              <span className="max-w-[200px] text-[12px] text-muted-foreground">
                {r.lastFailureReason ?? "—"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            cell: (r) => <ScheduledTransferActions row={r} />,
          },
        ]}
        rows={transfers}
        rowKey={(r) => r.id}
      />
    </div>
  );
}

export { RunDueTransfersButton };
