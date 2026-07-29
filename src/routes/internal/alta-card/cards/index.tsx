import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { buildListReturnPath } from "@/lib/internal/record-workspace-search";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { fetchInternalAltaCardsFiltered } from "@/lib/bank/alta-card.functions";
import type {
  AltaCardRow,
  AltaCardStatusCode,
  AltaCardTypeCode,
} from "@/lib/bank/alta-card-types";
import { altaCardStatusLabel } from "@/lib/bank/alta-card-types";
import {
  altaCardFiltersActive,
  cardBalanceLimitLabel,
  cardDirectoryPrimaryLabel,
  cardDirectorySecondaryLabel,
  cardHolderType,
  cardNeedsDirectoryAttention,
  maskAltaCardLastFour,
  sortCardsForDirectory,
} from "@/lib/internal/alta-card-desk";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type AltaCardsSearch = {
  q?: string;
  status?: AltaCardStatusCode;
  cardType?: AltaCardTypeCode;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/alta-card/cards/")({
  validateSearch: (search: Record<string, unknown>): AltaCardsSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
    status:
      typeof search.status === "string" && search.status
        ? (search.status as AltaCardStatusCode)
        : undefined,
    cardType:
      typeof search.cardType === "string" && search.cardType
        ? (search.cardType as AltaCardTypeCode)
        : undefined,
    attention:
      typeof search.attention === "string" && search.attention.trim()
        ? search.attention.trim()
        : undefined,
    site: readDevSiteFromSearch(search),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchInternalAltaCardsFiltered({
      data: {
        q: deps.q,
        status: deps.status,
        cardType: deps.cardType,
      },
    }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Alta Cards", (match.search as { site?: string }).site) }] }),
  component: InternalAltaCardsListPage,
});

function cardHrefSearch(from: string, site?: string) {
  return { ...withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, site), from };
}

function InternalAltaCardsListPage() {
  const cardsRaw = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  let cards = sortCardsForDirectory(cardsRaw);
  if (search.attention === "1") {
    cards = cards.filter((c) => cardNeedsDirectoryAttention(c));
  }
  if (search.cardType === "personal") {
    cards = cards.filter((c) => cardHolderType(c) === "personal");
  } else if (search.cardType === "business") {
    cards = cards.filter((c) => cardHolderType(c) === "company");
  }
  const returnFrom = buildListReturnPath("/internal/alta-card/cards", {
    q: search.q,
    status: search.status,
    cardType: search.cardType,
    attention: search.attention,
    site: search.site,
  });
  const activeFilters = altaCardFiltersActive(search);

  return (
    <InternalPageShell
      title="Cards"
      breadcrumbs={buildBreadcrumbs([
        { label: "Products", to: "/internal/lending", search: withInternalSiteSearch({}, search.site) },
        { label: "Alta Card", to: "/internal/alta-card", search: withInternalSiteSearch({}, search.site) },
        { label: "Cards" },
      ])}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void navigate({
            to: "/internal/alta-card/cards",
            search: withInternalSiteSearch(
              {
                q: (fd.get("q") as string) || undefined,
                status: ((fd.get("status") as string) || undefined) as AltaCardStatusCode | undefined,
                cardType: ((fd.get("cardType") as string) || undefined) as AltaCardTypeCode | undefined,
                attention: (fd.get("attention") as string) || undefined,
              },
              search.site,
            ),
          });
        }}
      >
        <OpsFilterBar className="sm:grid-cols-2 lg:grid-cols-4">
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
          <OpsFilterField label="Cardholder type">
            <select
              name="cardType"
              defaultValue={search.cardType ?? ""}
              className={OPS_FILTER_FIELD_CLASS}
            >
              <option value="">All types</option>
              <option value="personal">Personal</option>
              <option value="business">Company</option>
            </select>
          </OpsFilterField>
          <OpsFilterField label="Needs attention">
            <select
              name="attention"
              defaultValue={search.attention ?? ""}
              className={OPS_FILTER_FIELD_CLASS}
            >
              <option value="">Any</option>
              <option value="1">Needs attention</option>
            </select>
          </OpsFilterField>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold"
            >
              Apply
            </button>
            {activeFilters ? (
              <Link
                to="/internal/alta-card/cards"
                search={withInternalSiteSearch({}, search.site)}
                className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </OpsFilterBar>
      </form>

      <OpsSection title={`Cards (${cards.length}${cardsRaw.length >= 200 ? "+" : ""})`} className="mt-6">
        {cards.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-4 text-[13px] text-muted-foreground">
            {activeFilters ? "No Alta Cards match the current filters." : "No Alta Cards on record yet."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-md border border-border/60 md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border/60 bg-surface-1/40">
                  <tr>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Cardholder
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Card
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Balance / limit
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <CardDesktopRow
                      key={`desktop-${card.id}`}
                      card={card}
                      from={returnFrom}
                      site={search.site}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {cards.map((card) => (
                <li key={`mobile-${card.id}`}>
                  <Link
                    to="/internal/alta-card/$cardId"
                    params={{ cardId: card.id }}
                    search={cardHrefSearch(returnFrom, search.site)}
                    className={cn(
                      "block rounded-md border border-border/60 bg-surface-1/40 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
                      cardNeedsDirectoryAttention(card) && "border-destructive/30",
                    )}
                    aria-label={`Review card ${cardDirectoryPrimaryLabel(card)}, ${maskAltaCardLastFour(card.cardLastFour)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[13px]">{cardDirectoryPrimaryLabel(card)}</div>
                        <div className="text-[12px] text-muted-foreground">
                          {cardDirectorySecondaryLabel(card)}
                        </div>
                      </div>
                      <OpsStatusBadge status={altaCardStatusLabel(card.status)} />
                    </div>
                    <div className="mt-2 text-[12px] text-muted-foreground">
                      {cardBalanceLimitLabel(card)}
                    </div>
                    <div className="mt-2 text-[12px] font-medium text-gold">Review card</div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </OpsSection>
    </InternalPageShell>
  );
}

function CardDesktopRow({
  card,
  from,
  site,
}: {
  card: AltaCardRow;
  from: string;
  site?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/40 last:border-0 hover:bg-surface-1/50",
        cardNeedsDirectoryAttention(card) && "bg-destructive/[0.03]",
      )}
    >
      <td className="px-3 py-2.5">
        <Link
          to="/internal/alta-card/$cardId"
          params={{ cardId: card.id }}
          search={cardHrefSearch(from, site)}
          className="font-medium hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          {cardDirectoryPrimaryLabel(card)}
        </Link>
        {card.companyName && card.ownerUsername ? (
          <div className="text-[11px] text-muted-foreground">{card.companyName}</div>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <span aria-label={`Card ending ${card.cardLastFour}`}>
          {cardDirectorySecondaryLabel(card)}
        </span>
      </td>
      <td className="px-3 py-2.5 tabular-nums">{cardBalanceLimitLabel(card)}</td>
      <td className="px-3 py-2.5">
        <OpsStatusBadge status={altaCardStatusLabel(card.status)} />
      </td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
        {card.updatedAt.slice(0, 10)}
      </td>
    </tr>
  );
}
