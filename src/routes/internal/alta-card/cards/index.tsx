import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection, OpsTable, type OpsTableColumn } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { fetchInternalAltaCardsFiltered } from "@/lib/bank/alta-card.functions";
import type { AltaCardRow, AltaCardStatusCode, AltaCardTierCode, AltaCardTypeCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";

export type AltaCardsSearch = {
  q?: string;
  status?: AltaCardStatusCode;
  tier?: AltaCardTierCode;
  cardType?: AltaCardTypeCode;
};

export const Route = createFileRoute("/internal/alta-card/cards/")({
  validateSearch: (search: Record<string, unknown>): AltaCardsSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
    status: typeof search.status === "string" && search.status ? (search.status as AltaCardStatusCode) : undefined,
    tier: typeof search.tier === "string" && search.tier ? (search.tier as AltaCardTierCode) : undefined,
    cardType: typeof search.cardType === "string" && search.cardType ? (search.cardType as AltaCardTypeCode) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchInternalAltaCardsFiltered({ data: deps }),
  head: () => ({ meta: [{ title: "Alta Cards — Alta Internal" }] }),
  component: InternalAltaCardsListPage,
});

function InternalAltaCardsListPage() {
  const cards = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();

  const columns: OpsTableColumn<AltaCardRow>[] = [
    {
      key: "card",
      header: "Card",
      cell: (c) => (
        <Link
          to="/internal/alta-card/$cardId"
          params={{ cardId: c.id }}
          className="font-mono text-[12px] hover:text-gold"
        >
          ····{c.cardLastFour}
        </Link>
      ),
    },
    {
      key: "holder",
      header: "Cardholder",
      cell: (c) => c.ownerUsername ?? c.companyName ?? "—",
    },
    {
      key: "company",
      header: "Company",
      cell: (c) => c.companyName ?? "—",
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{c.cardType}</span>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      cell: (c) => ALTA_CARD_TIER_LABELS[c.tier],
    },
    {
      key: "limit",
      header: "Limit",
      cell: (c) => (
        <span className="type-finance tabular-nums">{formatAltaCardCurrency(c.creditLimit)}</span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      cell: (c) => (
        <span className="type-finance tabular-nums">{formatAltaCardCurrency(c.currentBalance)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <OpsStatusBadge status={altaCardStatusLabel(c.status)} />,
    },
    {
      key: "opened",
      header: "Opened",
      cell: (c) => (
        <span className="font-mono text-[11px]">{c.openedAt?.slice(0, 10) ?? "—"}</span>
      ),
    },
  ];

  return (
    <InternalPageShell
      title="Alta Cards"
      breadcrumbs={buildBreadcrumbs([
        { label: "Dashboard", to: "/internal" },
        { label: "Alta Card", to: "/internal/alta-card" },
        { label: "All cards" },
      ])}
    >
      <form>
        <OpsFilterBar>
          <OpsFilterField label="Search">
            <input
              name="q"
              defaultValue={search.q ?? ""}
              placeholder="Cardholder, company, last four…"
              className={OPS_FILTER_FIELD_CLASS}
            />
          </OpsFilterField>
          <OpsFilterField label="Status">
            <select name="status" defaultValue={search.status ?? ""} className={OPS_FILTER_FIELD_CLASS}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="frozen">Frozen</option>
              <option value="delinquent">Delinquent</option>
              <option value="lost">Lost</option>
              <option value="closed">Closed</option>
            </select>
          </OpsFilterField>
          <OpsFilterField label="Tier">
            <select name="tier" defaultValue={search.tier ?? ""} className={OPS_FILTER_FIELD_CLASS}>
              <option value="">All tiers</option>
              <option value="white">White</option>
              <option value="navy">Navy</option>
              <option value="black">Black</option>
              <option value="gold">Gold</option>
            </select>
          </OpsFilterField>
          <OpsFilterField label="Type">
            <select name="cardType" defaultValue={search.cardType ?? ""} className={OPS_FILTER_FIELD_CLASS}>
              <option value="">All types</option>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          </OpsFilterField>
          <div className="flex items-end gap-2 md:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold"
            >
              Apply
            </button>
            <Link
              to="/internal/alta-card/cards"
              className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground"
            >
              Clear
            </Link>
          </div>
        </OpsFilterBar>
      </form>

      <OpsSection title={`Cards (${cards.length}${cards.length >= 200 ? "+" : ""})`}>
        <OpsTable
          columns={columns}
          rows={cards}
          rowKey={(c) => c.id}
          onRowClick={(c) => {
            void router.navigate({ to: "/internal/alta-card/$cardId", params: { cardId: c.id } });
          }}
          emptyState="No Alta Cards match the current filters."
        />
      </OpsSection>
    </InternalPageShell>
  );
}
