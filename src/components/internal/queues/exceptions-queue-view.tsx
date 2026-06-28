"use client";

import { useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { OpsTable, type OpsTableColumn, type OpsTableSort } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { QueuePage } from "./queue-page";
import { QueueAgeCell } from "./queue-age-cell";
import { formatQueueDate, queueAgeMs } from "./queue-utils";
import { sortQueueRows } from "./queue-table-sort";
import { setExceptionDispositionOps } from "@/lib/internal/ops-v1.functions";
import { florin } from "@/lib/bank/api";

export type ExceptionQueueItem = {
  id: string;
  category: string;
  severity: string;
  title: string;
  detail: string;
  href: string;
  amount?: number | null;
  createdAt: string;
  dispositionStatus?: "OPEN" | "RESOLVED" | "ESCALATED" | "DISMISSED";
  dispositionReason?: string | null;
};

export function ExceptionsQueueView({ items }: { items: ExceptionQueueItem[] }) {
  const router = useRouter();
  const dispositionFn = useServerFn(setExceptionDispositionOps);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "high" | "escalated">("all");
  const [sort, setSort] = useState<OpsTableSort | null>({ key: "age", direction: "desc" });

  const filtered = useMemo(() => {
    let list = items;
    if (severityFilter === "escalated") {
      list = list.filter((i) => i.dispositionStatus === "ESCALATED");
    } else if (severityFilter !== "all") {
      list = list.filter((i) => i.severity === severityFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.detail.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      );
    }
    return sortQueueRows(list, sort, (row, key) =>
      key === "age" ? queueAgeMs(row.createdAt) : String((row as Record<string, unknown>)[key] ?? ""),
    );
  }, [items, query, severityFilter, sort]);

  const columns: OpsTableColumn<ExceptionQueueItem>[] = [
    {
      key: "type",
      header: "Type",
      cell: (i) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
          {i.category.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "entity",
      header: "Entity",
      cell: (i) => (
        <div>
          <div className="text-[12px] font-medium">{i.title}</div>
          <div className="text-[11px] text-muted-foreground">{i.detail}</div>
        </div>
      ),
    },
    {
      key: "age",
      header: "Age",
      cell: (i) => <QueueAgeCell isoOrDate={i.createdAt} />,
      sortable: true,
    },
    {
      key: "severity",
      header: "Severity",
      cell: (i) => (
        <OpsStatusBadge status={i.severity} tone={i.severity === "critical" ? "danger" : "warning"} />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (i) => (
        <OpsStatusBadge
          status={(i.dispositionStatus ?? "OPEN").replace(/_/g, " ")}
          tone={i.dispositionStatus === "ESCALATED" ? "danger" : "neutral"}
        />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (i) =>
        i.amount != null ? (
          <span className="type-finance tabular-nums">{florin(i.amount)}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "created",
      header: "Detected",
      cell: (i) => (
        <span className="font-mono text-[11px]">{formatQueueDate(i.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (i) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          <OpsAction
            label="Resolve"
            variant="primary"
            title="Resolve exception"
            description="Mark this exception as resolved. The underlying condition may still exist — document your resolution."
            confirmLabel="Resolve"
            onConfirm={async (reason) => {
              await dispositionFn({ data: { exceptionKey: i.id, status: "RESOLVED", reason } });
              void router.invalidate();
            }}
          />
          <OpsAction
            label="Escalate"
            variant="default"
            title="Escalate exception"
            description="Escalated exceptions remain visible for senior review."
            confirmLabel="Escalate"
            onConfirm={async (reason) => {
              await dispositionFn({ data: { exceptionKey: i.id, status: "ESCALATED", reason } });
              void router.invalidate();
            }}
          />
          <OpsAction
            label="Dismiss"
            variant="danger"
            title="Dismiss exception"
            description="Dismiss when this item is not actionable (e.g. known queue summary)."
            confirmLabel="Dismiss"
            onConfirm={async (reason) => {
              await dispositionFn({ data: { exceptionKey: i.id, status: "DISMISSED", reason } });
              void router.invalidate();
            }}
          />
        </div>
      ),
    },
  ];

  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const highCount = items.filter((i) => i.severity === "high").length;
  const escalatedCount = items.filter((i) => i.dispositionStatus === "ESCALATED").length;

  return (
    <QueuePage
      title="Exceptions"
      search={query}
      onSearchChange={setQuery}
      searchPlaceholder="Search exception, entity…"
      statusTabs={[
        { id: "all", label: "All", count: items.length },
        { id: "critical", label: "Critical", count: criticalCount },
        { id: "high", label: "High", count: highCount },
        { id: "escalated", label: "Escalated", count: escalatedCount },
      ]}
      activeStatus={severityFilter}
      onStatusChange={(id) => setSeverityFilter(id as typeof severityFilter)}
    >
      <OpsTable
        columns={columns}
        rows={filtered}
        rowKey={(i) => i.id}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(i) => void navigateExceptionHref(router, i.href)}
        emptyState="No open exceptions."
        filterSlot={
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {filtered.length} exception{filtered.length === 1 ? "" : "s"}
            </span>
            <OpsCsvExportButton
              filename="exceptions-queue.csv"
              headers={["type", "title", "severity", "status", "amount", "detected"]}
              getRows={() =>
                filtered.map((i) => [
                  i.category,
                  i.title,
                  i.severity,
                  i.dispositionStatus ?? "OPEN",
                  i.amount ?? "",
                  formatQueueDate(i.createdAt),
                ])
              }
            />
          </div>
        }
      />
    </QueuePage>
  );
}

function navigateExceptionHref(
  router: ReturnType<typeof import("@tanstack/react-router").useRouter>,
  href: string,
) {
  const accountMatch = href.match(/^\/internal\/bank\/accounts\/([^/]+)$/);
  if (accountMatch) {
    return router.navigate({
      to: "/internal/bank/accounts/$accountId",
      params: { accountId: accountMatch[1]! },
    });
  }
  const txMatch = href.match(/^\/internal\/bank\/transactions\/([^/]+)$/);
  if (txMatch) {
    return router.navigate({
      to: "/internal/bank/transactions/$transactionId",
      params: { transactionId: txMatch[1]! },
    });
  }
  if (href === "/internal/bank/transfers") {
    return router.navigate({ to: "/internal/bank/transfers" });
  }
  if (href === "/internal/bank/deposits" || href === "/internal/queues/deposits") {
    return router.navigate({ to: "/internal/queues/deposits" });
  }
  if (href === "/internal/bank/withdrawals" || href === "/internal/queues/withdrawals") {
    return router.navigate({ to: "/internal/queues/withdrawals" });
  }
  return router.navigate({ to: "/internal/audit" });
}
