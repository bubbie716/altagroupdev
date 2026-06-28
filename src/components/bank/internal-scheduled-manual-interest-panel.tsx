"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelScheduledManualInterestApplicationRecord,
  type ScheduledManualInterestRow,
} from "@/lib/bank/manual-interest.functions";
import { OpsAction } from "@/components/internal/ops-action";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isAdmin } from "@/lib/auth/permissions";

export function InternalScheduledManualInterestPanel({
  initialRows,
}: {
  initialRows: ScheduledManualInterestRow[];
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const canCancel = user ? isAdmin(user) : false;
  const cancelFn = useServerFn(cancelScheduledManualInterestApplicationRecord);

  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel(id: string, _reason: string) {
    setPendingId(id);
    setError(null);
    try {
      await cancelFn({ data: { id } });
      setRows((current) => current.filter((row) => row.id !== id));
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setPendingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No pending scheduled manual interest applications.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      <AdminDataTable
        columns={[
          {
            key: "scheduled",
            header: "Scheduled for",
            cell: (row: ScheduledManualInterestRow) => (
              <span className="font-mono text-[11px]">{row.scheduledFor.slice(0, 16).replace("T", " ")}</span>
            ),
          },
          {
            key: "mode",
            header: "Mode",
            cell: (row: ScheduledManualInterestRow) =>
              row.mode === "PERCENTAGE" ? "Percentage" : "Fixed amount",
          },
          {
            key: "categories",
            header: "Categories",
            cell: (row: ScheduledManualInterestRow) => (
              <span className="text-[12px]">{row.categoryLabels.join(", ")}</span>
            ),
          },
          {
            key: "reason",
            header: "Reason",
            cell: (row: ScheduledManualInterestRow) => row.reason,
          },
          {
            key: "createdBy",
            header: "Scheduled by",
            cell: (row: ScheduledManualInterestRow) => row.createdByUsername,
          },
          {
            key: "status",
            header: "Status",
            cell: (row: ScheduledManualInterestRow) => <StatusBadge status={row.status} />,
          },
          {
            key: "actions",
            header: "",
            cell: (row: ScheduledManualInterestRow) =>
              canCancel && row.status === "PENDING" ? (
                <OpsAction
                  label={pendingId === row.id ? "Cancelling…" : "Cancel"}
                  variant="danger"
                  title="Cancel scheduled interest"
                  description="Removes this pending scheduled interest application."
                  disabled={pendingId === row.id}
                  onConfirm={async (reason) => {
                    await handleCancel(row.id, reason);
                  }}
                />
              ) : null,
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
      />
    </div>
  );
}
