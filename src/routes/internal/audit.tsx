import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import type { AuditEntityType } from "@prisma/client";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { fetchAuditLogs, exportAuditLogsOps } from "@/lib/internal/audit.functions";
import type { AuditLogFilters, AuditLogViewMode } from "@/lib/internal/audit.types";
import { OpsSection } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_PAGE_SIZE,
  auditHasActiveFilters,
} from "@/lib/internal/audit-presentation";
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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

function str(search: Record<string, unknown>, key: string): string | undefined {
  return typeof search[key] === "string" && (search[key] as string).trim()
    ? (search[key] as string).trim()
    : undefined;
}

export const Route = createFileRoute("/internal/audit")({
  validateSearch: (search: Record<string, unknown>): InternalAuditSearch => {
    const entityType = str(search, "entityType");
    const category = str(search, "category");
    const viewRaw = str(search, "view");
    const view: AuditLogViewMode | undefined =
      viewRaw === "all" || viewRaw === "meaningful" ? viewRaw : undefined;
    const offsetRaw = search.offset;
    const offset =
      typeof offsetRaw === "number"
        ? offsetRaw
        : typeof offsetRaw === "string" && /^\d+$/.test(offsetRaw)
          ? Number(offsetRaw)
          : undefined;
    return {
      q: str(search, "q"),
      action: str(search, "action"),
      entityType:
        entityType && ENTITY_TYPES.includes(entityType as AuditEntityType)
          ? (entityType as AuditEntityType)
          : undefined,
      entityId: str(search, "entityId"),
      actorUserId: str(search, "actorUserId"),
      actor: str(search, "actor"),
      targetUserId: str(search, "targetUserId"),
      targetAccountId: str(search, "targetAccountId"),
      targetCompanyId: str(search, "targetCompanyId"),
      from: str(search, "from"),
      to: str(search, "to"),
      category:
        category && AUDIT_EVENT_CATEGORIES.some((c) => c.id === category)
          ? category
          : undefined,
      view,
      offset,
      site: readDevSiteFromSearch(search),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchAuditLogs({
      data: {
        ...deps,
        limit: AUDIT_PAGE_SIZE,
        offset: deps.offset ?? 0,
        view: deps.view ?? "meaningful",
      },
    }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Audit Log", (match.search as { site?: string }).site) }] }),
  component: InternalAuditPage,
});

function InternalAuditPage() {
  const page = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const exportFn = useServerFn(exportAuditLogsOps);
  const [exporting, setExporting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const siteKey = search.site;
  const view = search.view ?? "meaningful";
  const offset = search.offset ?? 0;
  const filtersActive = auditHasActiveFilters(search) || view === "all";

  function patchSearch(patch: Partial<InternalAuditSearch>, resetOffset = true) {
    void navigate({
      to: "/internal/audit",
      search: withInternalSiteSearch(
        {
          ...search,
          ...patch,
          ...(resetOffset ? { offset: undefined } : {}),
        },
        siteKey,
      ),
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportFn({
        data: { ...search, view, offset: undefined, limit: undefined },
      });
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
        { label: "System", to: "/internal/jobs", search: withInternalSiteSearch({}, siteKey) },
        { label: "Audit" },
      ])}
    >
      <p className="mb-4 text-[12px] text-muted-foreground">
        Official compliance trail — human-readable by default, full technical fields on demand.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          patchSearch({
            q: (fd.get("q") as string) || undefined,
            category: (fd.get("category") as string) || undefined,
            actor: (fd.get("actor") as string) || undefined,
            from: (fd.get("from") as string) || undefined,
            to: (fd.get("to") as string) || undefined,
          });
        }}
      >
        <OpsFilterBar className="sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Search" name="q" defaultValue={search.q} placeholder="Description or keyword…" />
          <OpsFilterField label="Event category">
            <select
              name="category"
              defaultValue={search.category ?? ""}
              className={OPS_FILTER_FIELD_CLASS}
            >
              <option value="">Any</option>
              {AUDIT_EVENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </OpsFilterField>
          <FilterField
            label="Actor"
            name="actor"
            defaultValue={search.actor}
            placeholder="Username…"
          />
          <div className="grid grid-cols-2 gap-2">
            <FilterField label="From" name="from" type="date" defaultValue={search.from?.slice(0, 10)} />
            <FilterField label="To" name="to" type="date" defaultValue={search.to?.slice(0, 10)} />
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              className="h-8 rounded border border-border px-3 text-[12px] text-muted-foreground"
            >
              Advanced filters
            </button>
            {filtersActive ? (
              <Link
                to="/internal/audit"
                search={withInternalSiteSearch({}, siteKey)}
                className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground"
              >
                Clear
              </Link>
            ) : null}
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground disabled:opacity-50"
            >
              {exporting ? SUBMITTING_COPY.exporting : "Export CSV"}
            </button>
            <div className="ml-auto flex items-center gap-2 text-[12px]">
              <span className="text-muted-foreground">View</span>
              <button
                type="button"
                className={
                  view === "meaningful"
                    ? "font-medium text-gold"
                    : "text-muted-foreground hover:text-foreground"
                }
                onClick={() => patchSearch({ view: "meaningful" })}
              >
                Meaningful events
              </button>
              <span className="text-muted-foreground/50">·</span>
              <button
                type="button"
                className={
                  view === "all" ? "font-medium text-gold" : "text-muted-foreground hover:text-foreground"
                }
                onClick={() => patchSearch({ view: "all" })}
              >
                All events
              </button>
            </div>
          </div>
        </OpsFilterBar>
      </form>

      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[var(--internal-sheet-available-height,100dvh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
            <SheetTitle className="text-left text-[15px]">Advanced filters</SheetTitle>
            <SheetDescription className="text-left text-[12px]">
              Exact codes and IDs for compliance debugging.
            </SheetDescription>
          </SheetHeader>
          <form
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              patchSearch({
                action: (fd.get("action") as string) || undefined,
                entityType: ((fd.get("entityType") as string) || undefined) as AuditEntityType | undefined,
                entityId: (fd.get("entityId") as string) || undefined,
                actorUserId: (fd.get("actorUserId") as string) || undefined,
                targetUserId: (fd.get("targetUserId") as string) || undefined,
                targetAccountId: (fd.get("targetAccountId") as string) || undefined,
                targetCompanyId: (fd.get("targetCompanyId") as string) || undefined,
                from: (fd.get("from") as string) || search.from,
                to: (fd.get("to") as string) || search.to,
              });
              setAdvancedOpen(false);
            }}
          >
            <FilterField label="Exact action code" name="action" defaultValue={search.action} mono />
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
            <FilterField label="Entity ID" name="entityId" defaultValue={search.entityId} mono />
            <FilterField label="Actor user ID" name="actorUserId" defaultValue={search.actorUserId} mono />
            <FilterField label="Target user ID" name="targetUserId" defaultValue={search.targetUserId} mono />
            <FilterField
              label="Target account ID"
              name="targetAccountId"
              defaultValue={search.targetAccountId}
              mono
            />
            <FilterField
              label="Target company ID"
              name="targetCompanyId"
              defaultValue={search.targetCompanyId}
              mono
            />
            <FilterField label="From (exact)" name="from" type="date" defaultValue={search.from?.slice(0, 10)} />
            <FilterField label="To (exact)" name="to" type="date" defaultValue={search.to?.slice(0, 10)} />
            <button
              type="submit"
              className="h-9 w-full rounded border border-gold/40 bg-gold/10 text-[13px] font-medium text-gold"
            >
              Apply advanced filters
            </button>
          </form>
        </SheetContent>
      </Sheet>

      <OpsSection
        title={`Entries ${offset + 1}–${offset + page.rows.length}${page.hasMore ? "+" : ""}`}
        className="mt-6"
      >
        <InternalAuditTable rows={page.rows} groupRepeats />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={offset <= 0}
            className="rounded border border-border px-3 py-1.5 text-[12px] disabled:opacity-40"
            onClick={() =>
              patchSearch({ offset: Math.max(0, offset - AUDIT_PAGE_SIZE) }, false)
            }
          >
            Previous
          </button>
          <span className="text-[12px] text-muted-foreground">
            Page {Math.floor(offset / AUDIT_PAGE_SIZE) + 1}
          </span>
          <button
            type="button"
            disabled={!page.hasMore}
            className="rounded border border-border px-3 py-1.5 text-[12px] disabled:opacity-40"
            onClick={() => patchSearch({ offset: offset + AUDIT_PAGE_SIZE }, false)}
          >
            Next
          </button>
        </div>
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
