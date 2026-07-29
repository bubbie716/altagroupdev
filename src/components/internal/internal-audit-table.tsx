"use client";

import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { INTERNAL_ACCOUNT_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { Card } from "@/components/page-shell";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import { formatSilentNotificationAuditDetail } from "@/lib/internal/operator-notification-options";
import { formatOpsAuditActionTitle } from "@/lib/internal/ops-activity-title";
import {
  auditTargetLabel,
  groupConsecutiveAuditRows,
  type AuditDisplayRow,
} from "@/lib/internal/audit-presentation";

export function AccountActivityLink({
  accountId,
  accountName,
  accountNumber,
  label,
}: {
  accountId: string | null | undefined;
  accountName?: string | null;
  accountNumber?: string | null;
  label?: string | null;
}) {
  const site = useRouterState({
    select: (s) => readDevSiteFromSearch(s.location.search as Record<string, unknown>),
  });

  if (!accountId) {
    return <span className="text-muted-foreground">—</span>;
  }

  const name = accountName ?? (label?.includes(" · ") ? label.split(" · ")[0] : null);
  const number =
    accountNumber ?? (label?.includes(" · ") ? label.split(" · ").slice(1).join(" · ") : label);

  if (!name && !number) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Link
      to="/internal/bank/accounts/$accountId"
      params={{ accountId }}
      search={withInternalSiteSearch(INTERNAL_ACCOUNT_WORKSPACE_SEARCH, site)}
      className="hover:text-gold"
    >
      {name ? <div className="text-[12px]">{name}</div> : null}
      {number ? <div className="font-mono text-[11px] text-muted-foreground">{number}</div> : null}
    </Link>
  );
}

function TechnicalDetails({ row }: { row: AuditLogRow }) {
  return (
    <dl className="mt-2 grid gap-1 rounded border border-border/50 bg-surface-1/30 px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
      <div>
        <dt className="inline text-muted-foreground/80">Action code · </dt>
        <dd className="inline text-foreground/80">{row.action}</dd>
      </div>
      <div>
        <dt className="inline text-muted-foreground/80">Entity · </dt>
        <dd className="inline">
          {row.entityType}
          {row.entityId ? ` · ${row.entityId}` : ""}
        </dd>
      </div>
      {row.targetUserId ? (
        <div>
          <dt className="inline text-muted-foreground/80">Target user · </dt>
          <dd className="inline">{row.targetUserId}</dd>
        </div>
      ) : null}
      {row.targetAccountId ? (
        <div>
          <dt className="inline text-muted-foreground/80">Target account · </dt>
          <dd className="inline">{row.targetAccountId}</dd>
        </div>
      ) : null}
      {row.targetCompanyId ? (
        <div>
          <dt className="inline text-muted-foreground/80">Target company · </dt>
          <dd className="inline">{row.targetCompanyId}</dd>
        </div>
      ) : null}
      {row.metadata ? (
        <div className="mt-1 break-all">
          <dt className="text-muted-foreground/80">Metadata</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">{JSON.stringify(row.metadata, null, 2)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function AuditSingleRow({
  row,
  showAccount,
}: {
  row: AuditLogRow;
  showAccount: boolean;
}) {
  const [open, setOpen] = useState(false);
  const silentDetail = formatSilentNotificationAuditDetail(row.metadata);
  const title = formatOpsAuditActionTitle(row.action);

  return (
    <li className="border-b border-border/40 px-3 py-3 last:border-0 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[13px]">{title}</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {row.actorUsername}
            <span className="text-muted-foreground/60"> · </span>
            {auditTargetLabel(row)}
          </div>
          {row.description && row.description !== title ? (
            <p className="mt-1 text-[12px] text-muted-foreground">{row.description}</p>
          ) : null}
          {silentDetail ? (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-600/90">
              {silentDetail}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-[11px] text-muted-foreground">
            {formatActivityDateTime(row.createdAt)}
          </div>
          {showAccount && row.targetAccountId ? (
            <div className="mt-1">
              <AccountActivityLink
                accountId={row.targetAccountId}
                accountName={row.targetAccountName}
                accountNumber={row.targetAccountNumber}
              />
            </div>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="mt-2 text-[11px] text-gold hover:underline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide technical details" : "Technical details"}
      </button>
      {open ? <TechnicalDetails row={row} /> : null}
    </li>
  );
}

function AuditGroupRow({
  item,
  showAccount,
}: {
  item: Extract<AuditDisplayRow, { kind: "group" }>;
  showAccount: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="border-b border-border/40 px-3 py-3 last:border-0 sm:px-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-[13px]">
            {item.count}× {item.title}
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Repeated low-value events · latest {item.first.actorUsername}
          </p>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          {formatActivityDateTime(item.first.createdAt)}
        </div>
      </div>
      <button
        type="button"
        className="mt-2 text-[11px] text-gold hover:underline"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Collapse events" : `Show ${item.count} events`}
      </button>
      {expanded ? (
        <ul className="mt-2 space-y-2 border-l border-border/50 pl-3">
          {item.rows.map((row) => (
            <AuditSingleRow key={row.id} row={row} showAccount={showAccount} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function InternalAuditTable({
  rows,
  showAccount = true,
  groupRepeats = false,
}: {
  rows: AuditLogRow[];
  showAccount?: boolean;
  /** Collapse consecutive identical low-value events (Audit page default). */
  groupRepeats?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card className="!p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          No audit entries yet
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Operator actions will appear here as they are performed.
        </p>
      </Card>
    );
  }

  const display = groupRepeats ? groupConsecutiveAuditRows(rows) : rows.map((row) => ({ kind: "single" as const, row }));

  return (
    <Card className="!p-0 overflow-hidden">
      <ul className="divide-y-0">
        {display.map((item) =>
          item.kind === "group" ? (
            <AuditGroupRow key={`g-${item.first.id}`} item={item} showAccount={showAccount} />
          ) : (
            <AuditSingleRow key={item.row.id} row={item.row} showAccount={showAccount} />
          ),
        )}
      </ul>
    </Card>
  );
}
