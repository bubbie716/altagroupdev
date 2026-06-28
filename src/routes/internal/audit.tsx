import { createFileRoute, Link } from "@tanstack/react-router";
import type { AuditEntityType } from "@prisma/client";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { fetchAuditLogs, exportAuditLogsOps } from "@/lib/internal/audit.functions";
import type { AuditLogFilters } from "@/lib/internal/audit.types";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export type InternalAuditSearch = AuditLogFilters;

const ENTITY_TYPES: AuditEntityType[] = [
  "USER",
  "BANK_ACCOUNT",
  "BANK_TRANSACTION",
  "COMPANY",
  "LOAN",
  "LOAN_APPLICATION",
  "DEAL_ROOM",
  "SCHEDULED_PAYMENT",
  "STATEMENT",
  "PLATFORM",
  "ALTA_CARD",
];

export const Route = createFileRoute("/internal/audit")({
  validateSearch: (search: Record<string, unknown>): InternalAuditSearch => {
    const str = (key: string) =>
      typeof search[key] === "string" && (search[key] as string).trim()
        ? (search[key] as string).trim()
        : undefined;
    const entityType = str("entityType");
    return {
      q: str("q"),
      action: str("action"),
      entityType: entityType && ENTITY_TYPES.includes(entityType as AuditEntityType)
        ? (entityType as AuditEntityType)
        : undefined,
      entityId: str("entityId"),
      actorUserId: str("actorUserId"),
      targetUserId: str("targetUserId"),
      targetAccountId: str("targetAccountId"),
      targetCompanyId: str("targetCompanyId"),
      from: str("from"),
      to: str("to"),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchAuditLogs({ data: deps }),
  head: () => ({ meta: [{ title: "Audit Log — Alta Internal" }] }),
  component: InternalAuditPage,
});

function InternalAuditPage() {
  const rows = Route.useLoaderData();
  const search = Route.useSearch();
  const exportFn = useServerFn(exportAuditLogsOps);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportFn({ data: search });
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <InternalPageShell
      title="Audit Log"
      breadcrumbs={buildBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Audit" },
      ])}
    >
      <p className="mb-4 text-[12px] text-muted-foreground">
        Official compliance trail — not the dashboard activity feed.
      </p>

      <form>
        <OpsFilterBar className="lg:grid-cols-3">
        <FilterField label="Search" name="q" defaultValue={search.q} placeholder="Description or actor…" />
        <FilterField label="Action" name="action" defaultValue={search.action} placeholder="Action code" mono />
        <OpsFilterField label="Entity type">
          <select
            name="entityType"
            defaultValue={search.entityType ?? ""}
            className={OPS_FILTER_FIELD_CLASS}
          >
            <option value="">Any</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </OpsFilterField>
        <FilterField label="Entity ID" name="entityId" defaultValue={search.entityId} placeholder="Entity ID" mono />
        <FilterField label="Actor user ID" name="actorUserId" defaultValue={search.actorUserId} mono />
        <FilterField label="Target user ID" name="targetUserId" defaultValue={search.targetUserId} mono />
        <FilterField label="Target account ID" name="targetAccountId" defaultValue={search.targetAccountId} mono />
        <FilterField label="Target company ID" name="targetCompanyId" defaultValue={search.targetCompanyId} mono />
        <FilterField label="From date" name="from" type="date" defaultValue={search.from?.slice(0, 10)} />
        <FilterField label="To date" name="to" type="date" defaultValue={search.to?.slice(0, 10)} />
        <div className="flex flex-wrap items-end gap-2 lg:col-span-3">
          <button
            type="submit"
            className="h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold"
          >
            Apply filters
          </button>
          <Link
            to="/internal/audit"
            className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground"
          >
            Clear
          </Link>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
        </OpsFilterBar>
      </form>

      <OpsSection title={`Entries (${rows.length}${rows.length >= 200 ? "+" : ""})`}>
        <InternalAuditTable rows={rows} />
      </OpsSection>
    </InternalPageShell>
  );
}

function FilterField({
  label,
  name,
  defaultValue,
  placeholder,
  mono,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <OpsFilterField label={label}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={`${OPS_FILTER_FIELD_CLASS} ${mono ? "font-mono" : ""}`}
      />
    </OpsFilterField>
  );
}
