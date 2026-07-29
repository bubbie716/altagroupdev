import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { OpsSection } from "@/components/internal/console";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  buildListReturnPath,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import { displayRelationshipTierLabelFromCode } from "@/lib/bank/relationship-terminology";
import { fetchRelationshipIntelligenceDashboard } from "@/lib/internal/relationship-intelligence.functions";
import {
  RELATIONSHIP_LIST_PAGE_SIZE,
  buildRelationshipDirectoryRows,
  relationshipTierFilterOptions,
  type RelationshipDirectoryRow,
} from "@/lib/internal/relationship-desk";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type RelationshipsSearch = {
  q?: string;
  tier?: string;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/relationships/")({
  validateSearch: (s: Record<string, unknown>): RelationshipsSearch => ({
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
    tier: typeof s.tier === "string" && s.tier.trim() ? s.tier.trim() : undefined,
    attention: s.attention === "1" ? "1" : undefined,
    site: validateDevSiteSearch(s).site,
  }),
  loader: async () => fetchRelationshipIntelligenceDashboard(),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Relationships", (match.search as { site?: string }).site) }] }),
  component: InternalRelationshipsIndexPage,
});

function InternalRelationshipsIndexPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const rows = buildRelationshipDirectoryRows(data);
  const attentionRows = rows.filter((r) => r.needsAttention);
  const q = search.q?.toLowerCase() ?? "";
  const filtersOn = Boolean(search.q || search.tier || search.attention);

  const filtered = rows.filter((row) => {
    if (search.attention === "1" && !row.needsAttention) return false;
    if (search.tier && row.tier !== search.tier) return false;
    if (!q) return true;
    return [row.label, row.tier, String(row.score), row.attentionDetail ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const [visible, setVisible] = useState(RELATIONSHIP_LIST_PAGE_SIZE);
  useEffect(() => {
    setVisible(RELATIONSHIP_LIST_PAGE_SIZE);
  }, [search.q, search.tier, search.attention]);
  const page = filtered.slice(0, visible);

  const returnFrom = buildListReturnPath("/internal/relationships", {
    q: search.q,
    tier: search.tier,
    attention: search.attention,
    site: search.site,
  });

  const tierOptions = relationshipTierFilterOptions(rows);

  function patchSearch(patch: Partial<RelationshipsSearch>) {
    void navigate({
      to: "/internal/relationships",
      search: withInternalSiteSearch(
        {
          q: patch.q !== undefined ? patch.q || undefined : search.q,
          tier: patch.tier !== undefined ? patch.tier || undefined : search.tier,
          attention: patch.attention !== undefined ? patch.attention : search.attention,
        },
        search.site,
      ),
      replace: true,
    });
  }

  function customerSearch() {
    return withInternalSiteSearch(
      {
        tab: "overview" as const,
        section: "relationship",
        from: returnFrom,
      },
      search.site,
    );
  }

  return (
    <InternalPageShell title="Relationships">
      <p className="mb-4 max-w-2xl text-[13px] text-muted-foreground">
        Relationship profiles across Alta Bank, Card, lending, and business banking. Open a customer
        to manage recommendations.
      </p>

      {attentionRows.length > 0 ? (
        <OpsSection title="Needs attention" className="mb-6">
          <ul className="space-y-2">
            {attentionRows.slice(0, 8).map((row) => (
              <li key={`attn-${row.userId}`}>
                <Link
                  to="/internal/users/$userId"
                  params={{ userId: row.userId }}
                  search={customerSearch()}
                  className="block rounded-md border border-amber-500/35 bg-amber-500/5 px-3 py-2.5 hover:border-amber-500/55"
                >
                  <div className="text-[13px] font-medium">{row.label}</div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {row.attentionDetail}
                    {row.recentChange ? ` · ${row.recentChange}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </OpsSection>
      ) : null}

      <OpsSection title="Relationship directory">
        <OpsFilterBar
          onClear={
            filtersOn
              ? () =>
                  void navigate({
                    to: "/internal/relationships",
                    search: withInternalSiteSearch({}, search.site),
                    replace: true,
                  })
              : undefined
          }
        >
          <OpsFilterField label="Search">
            <input
              className={OPS_FILTER_FIELD_CLASS}
              value={search.q ?? ""}
              onChange={(e) => patchSearch({ q: e.target.value || undefined })}
              placeholder="Customer…"
              aria-label="Search relationships"
            />
          </OpsFilterField>
          <OpsFilterField label="Tier">
            <select
              className={OPS_FILTER_FIELD_CLASS}
              value={search.tier ?? ""}
              onChange={(e) => patchSearch({ tier: e.target.value || undefined })}
              aria-label="Filter by tier"
            >
              <option value="">All</option>
              {tierOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </OpsFilterField>
          <OpsFilterField label="Needs attention">
            <select
              className={OPS_FILTER_FIELD_CLASS}
              value={search.attention ?? ""}
              onChange={(e) => patchSearch({ attention: e.target.value === "1" ? "1" : undefined })}
              aria-label="Needs attention filter"
            >
              <option value="">Any</option>
              <option value="1">Needs attention</option>
            </select>
          </OpsFilterField>
        </OpsFilterBar>

        {filtered.length === 0 ? (
          <p className="mt-6 text-[13px] text-muted-foreground">
            {filtersOn
              ? "No relationships match this filter."
              : "No persisted profiles yet. Open a customer and refresh to create one."}
          </p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[42rem] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Tier</th>
                    <th className="py-2 pr-3 font-medium">Score</th>
                    <th className="py-2 pr-3 font-medium">Recent change</th>
                    <th className="py-2 pr-3 font-medium">Last calculated</th>
                    <th className="py-2 font-medium">Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {page.map((row) => (
                    <RelationshipTableRow
                      key={`desktop-${row.userId}`}
                      row={row}
                      search={customerSearch()}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-4 space-y-3 md:hidden">
              {page.map((row) => (
                <li key={`mobile-${row.userId}`}>
                  <Link
                    to="/internal/users/$userId"
                    params={{ userId: row.userId }}
                    search={customerSearch()}
                    className={cn(
                      "block rounded-md border border-border/70 bg-surface-1/40 px-3 py-3 hover:border-gold/40",
                      row.needsAttention ? "border-amber-500/40" : undefined,
                    )}
                    aria-label={`Review relationship ${row.label}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{row.label}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {displayRelationshipTierLabelFromCode(row.tier)} · Score {row.score}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                      {row.recentChange ? <span>{row.recentChange}</span> : null}
                      {row.lastCalculatedAt ? (
                        <span className="font-mono text-[11px]">
                          {formatActivityDateTime(row.lastCalculatedAt)}
                        </span>
                      ) : null}
                      {row.needsAttention ? (
                        <span className="text-amber-700 dark:text-amber-300">Needs attention</span>
                      ) : null}
                    </div>
                    <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                      Review relationship
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {filtered.length > visible ? (
              <div className="mt-4">
                <button
                  type="button"
                  className="h-8 rounded border border-border px-3 text-[12px] hover:border-border-strong"
                  onClick={() => setVisible((n) => n + RELATIONSHIP_LIST_PAGE_SIZE)}
                >
                  Show more
                </button>
              </div>
            ) : null}
          </>
        )}
      </OpsSection>
    </InternalPageShell>
  );
}

function RelationshipTableRow({
  row,
  search,
}: {
  row: RelationshipDirectoryRow;
  search: {
    tab: "overview";
    section: string;
    from?: string;
    site?: string;
  };
}) {
  return (
    <tr className="border-b border-border/60 align-top">
      <td className="py-3 pr-3">
        <Link
          to="/internal/users/$userId"
          params={{ userId: row.userId }}
          search={search}
          className="font-medium hover:text-gold"
        >
          {row.label}
        </Link>
      </td>
      <td className="py-3 pr-3 text-muted-foreground">
        {displayRelationshipTierLabelFromCode(row.tier)}
      </td>
      <td className="py-3 pr-3 tabular-nums">{row.score}</td>
      <td className="py-3 pr-3 text-[12px] text-muted-foreground">{row.recentChange ?? "—"}</td>
      <td className="py-3 pr-3 font-mono text-[11px] text-muted-foreground">
        {row.lastCalculatedAt ? formatActivityDateTime(row.lastCalculatedAt) : "—"}
      </td>
      <td className="py-3 text-[11px] text-amber-700 dark:text-amber-300">
        {row.needsAttention ? row.attentionDetail ?? "Needs attention" : "—"}
      </td>
    </tr>
  );
}
