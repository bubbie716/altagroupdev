import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { fetchAuditLogs } from "@/lib/internal/audit.functions";
import type { AuditLogFilters } from "@/lib/internal/audit.types";

export type InternalAuditSearch = AuditLogFilters;

export const Route = createFileRoute("/internal/audit")({
  validateSearch: (search: Record<string, unknown>): InternalAuditSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
    action: typeof search.action === "string" && search.action.trim() ? search.action.trim() : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchAuditLogs({ data: deps }),
  head: () => ({ meta: [{ title: "Audit Log — Alta Internal" }] }),
  component: InternalAuditPage,
});

function InternalAuditPage() {
  const rows = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <InternalPageShell
      title="Audit Log"
      description="Append-only record of operator and admin actions across Alta platform systems."
    >
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={search.q ?? ""}
          placeholder="Search description or actor…"
          className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          name="action"
          defaultValue={search.action ?? ""}
          placeholder="Action code"
          className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-[12px]"
        />
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-[12px] font-medium text-background"
        >
          Filter
        </button>
        <Link
          to="/internal/audit"
          className="rounded-md border border-border px-4 py-2 text-[12px] text-muted-foreground"
        >
          Clear
        </Link>
      </form>

      <Section title={`Entries (${rows.length}${rows.length >= 200 ? "+" : ""})`}>
        <InternalAuditTable rows={rows} />
      </Section>
    </InternalPageShell>
  );
}
