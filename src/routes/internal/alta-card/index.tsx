import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsQueueCard } from "@/components/internal/ops-queue-card";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { fetchInternalAltaCardOps } from "@/lib/bank/alta-card.functions";
import { fetchInternalAltaCardReviewQueue } from "@/lib/bank/alta-card-review.functions";
import { isOpenAltaCardReviewStatus } from "@/lib/bank/alta-card-review-types";
import {
  altaCardStatusLabel,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import { useSiteContext } from "@/hooks/use-site-context";
import {
  INTERNAL_ALTA_CARD_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import {
  buildAltaCardAttentionItems,
  cardDirectoryPrimaryLabel,
  cardDirectorySecondaryLabel,
  cardNeedsDirectoryAttention,
  sortCardsForDirectory,
} from "@/lib/internal/alta-card-desk";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/alta-card/")({
  loader: async () => {
    const [ops, reviews] = await Promise.all([
      fetchInternalAltaCardOps({ data: {} }),
      fetchInternalAltaCardReviewQueue(),
    ]);
    return {
      ...ops,
      openReviews: reviews.filter((r) => isOpenAltaCardReviewStatus(r.status)).length,
    };
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Alta Card", (match.search as { site?: string }).site) }] }),
  component: InternalAltaCard,
});

function InternalAltaCard() {
  const { cards, applications, openReviews } = Route.useLoaderData();
  const site = useSiteContext();
  const pendingApps = applications.filter((a) =>
    ["submitted", "under_review", "needs_info"].includes(String(a.status).toLowerCase()),
  ).length;
  const active = cards.filter((c) => String(c.status).toLowerCase() === "active");
  const frozen = cards.filter((c) => c.status === "frozen");
  const delinquent = cards.filter((c) => c.status === "delinquent");
  const lostStolen = cards.filter((c) => c.status === "lost");
  const attention = buildAltaCardAttentionItems({
    pendingApplications: pendingApps,
    openReviews,
    lostStolen: lostStolen.length,
    delinquent: delinquent.length,
    siteKey: site.key,
    withSite: withInternalSiteSearch,
  });
  const preview = sortCardsForDirectory(cards).slice(0, 4);
  const outstanding = cards.reduce((sum, c) => sum + c.currentBalance, 0);

  return (
    <InternalPageShell
      title="Alta Card"
      breadcrumbs={buildBreadcrumbs([
        { label: "Products", to: "/internal/lending", search: withInternalSiteSearch({}, site.key) },
        { label: "Alta Card" },
      ])}
    >
      <OpsSection title="Needs attention">
        {attention.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-2.5 text-[13px] text-muted-foreground">
            No Alta Card work needs attention
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attention.map((item) => (
              <OpsQueueCard
                key={item.id}
                label={item.label}
                count={item.count}
                to={item.to}
                search={item.search}
                cta={item.cta}
                tone={item.tone}
              />
            ))}
          </div>
        )}
      </OpsSection>

      <OpsSection title="Cards" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">Browse issued Alta Cards.</p>
          <Link
            to="/internal/alta-card/cards"
            search={withInternalSiteSearch({}, site.key)}
            className="rounded border border-gold/40 bg-gold/10 px-3 py-1.5 text-[12px] font-medium text-gold"
          >
            Browse cards
          </Link>
        </div>
        {preview.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No cards to preview.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((card) => (
              <li key={card.id}>
                <Link
                  to="/internal/alta-card/$cardId"
                  params={{ cardId: card.id }}
                  search={withInternalSiteSearch(INTERNAL_ALTA_CARD_WORKSPACE_SEARCH, site.key)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-3 py-2 hover:border-gold/40"
                  aria-label={`Review card ${cardDirectoryPrimaryLabel(card)}, ${cardDirectorySecondaryLabel(card)}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[13px]">{cardDirectoryPrimaryLabel(card)}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {cardDirectorySecondaryLabel(card)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-[13px]">
                      {formatAltaCardCurrency(card.currentBalance)}
                    </span>
                    <OpsStatusBadge status={altaCardStatusLabel(card.status)} />
                    {cardNeedsDirectoryAttention(card) ? (
                      <span className="sr-only">Needs attention</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </OpsSection>

      <OpsSection title="Portfolio summary" className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Active cards" value={String(active.length)} />
          <Metric label="Frozen cards" value={String(frozen.length)} />
          <Metric label="Delinquent cards" value={String(delinquent.length)} />
          <Metric label="Outstanding balance" value={formatAltaCardCurrency(outstanding)} />
        </div>
      </OpsSection>

      <p className="mt-6 text-[12px] text-muted-foreground">
        Billing healthy ·{" "}
        <Link
          to="/internal/jobs"
          search={withInternalSiteSearch({}, site.key)}
          className="text-gold hover:underline"
        >
          System Jobs
        </Link>
      </p>
    </InternalPageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tabular">{value}</div>
    </div>
  );
}
