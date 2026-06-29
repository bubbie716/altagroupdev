import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import {
  ProductTags,
  RelationshipAssetValue,
  RelationshipProgressBar,
  RelationshipTierPill,
  RelationshipTimelineList,
  RELATIONSHIP_METRIC_LABEL,
  RELATIONSHIP_METRIC_VALUE,
  RELATIONSHIP_SECTION_GAP,
  RELATIONSHIP_STAT_CELL,
  RELATIONSHIP_STAT_GRID,
} from "@/components/bank/customer-relationship-shared";
import { authBeforeLoad } from "@/lib/auth/guards";
import { florin } from "@/lib/bank/api";
import {
  customerProductLabels,
  formatMembershipDuration,
} from "@/lib/bank/customer-relationship-display";
import { fetchCustomerRelationshipView } from "@/lib/bank/relationship-intelligence.functions";
import { fetchCustomerAltaPrivatePageState } from "@/lib/bank/alta-private.functions";
import { formatDueDate } from "@/lib/format-datetime";
import { cn } from "@/lib/utils";
import { useAltaPrivateClientContext } from "@/hooks/use-alta-private-client-context";
import {
  AltaPrivateBankerCard,
  AltaPrivateBenefitsHint,
  AltaPrivateMemberSinceCard,
} from "@/components/bank/alta-private/alta-private-client-chrome";

export const Route = createFileRoute("/bank/relationship")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const [view, pageState] = await Promise.all([
      fetchCustomerRelationshipView(),
      fetchCustomerAltaPrivatePageState(),
    ]);
    return { view, pageState };
  },
  head: () => ({ meta: [{ title: "Your Alta Relationship — Alta Bank" }] }),
  component: BankRelationshipPage,
});

function BankRelationshipPage() {
  const { view, pageState } = Route.useLoaderData();
  const privateClient = useAltaPrivateClientContext();
  const productLabels = customerProductLabels(view.productsHeld);
  const memberDuration = formatMembershipDuration(view.relationshipSince);
  const altaPrivateLabel = view.privateBankingClient ? "Active" : view.altaPrivateStatusLabel;

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank"
        title="Your Alta relationship"
        subtitle={privateClient.isMember ? "Alta Private Client" : undefined}
        description="A consolidated view of your relationship with Alta Bank and affiliated products."
      />
<Section title="Relationship overview">
        <Card className="min-w-0 max-w-full !p-5 sm:!p-6 hover:!border-border">
          <dl className={RELATIONSHIP_STAT_GRID}>
            <div className={cn(RELATIONSHIP_STAT_CELL, "sm:col-span-2 lg:col-span-1")}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Relationship tier</dt>
              <dd className="mt-2">
                <RelationshipTierPill label={view.relationshipTierLabel} />
              </dd>
            </div>
            <div className={cn(RELATIONSHIP_STAT_CELL, "sm:col-span-2 lg:col-span-1")}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Alta Private</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "font-medium")}>{altaPrivateLabel}</dd>
              {privateClient.isMember && privateClient.memberSinceLabel ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Member since {privateClient.memberSinceLabel}
                </p>
              ) : null}
            </div>
            <div className={cn(RELATIONSHIP_STAT_CELL, "sm:col-span-2 lg:col-span-1")}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Total Alta assets</dt>
              <dd className="mt-1.5">
                <RelationshipAssetValue>{florin(view.totalAltaAssets)}</RelationshipAssetValue>
              </dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Relationship since</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "font-medium")}>
                {formatDueDate(view.relationshipSince)}
              </dd>
              {memberDuration ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">{memberDuration}</p>
              ) : null}
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Products held</dt>
              <dd className="mt-2">
                <ProductTags labels={productLabels} />
              </dd>
            </div>
          </dl>

          <RelationshipProgressBar {...view.relationshipProgress} />

          {pageState.kind === "invited" ? (
            <div className="mt-5 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[14px]">
              You&apos;re invited to Alta Private.{" "}
              <Link to="/bank/private" className="font-medium text-gold hover:underline">
                Review your invitation
              </Link>
            </div>
          ) : view.privateBankingEligible && !view.privateBankingClient ? (
            <div className="mt-5 rounded-lg border border-border bg-surface-1/80 px-4 py-3 text-[14px] text-muted-foreground">
              You may qualify for Alta Private over time. Membership is extended by invitation only.
            </div>
          ) : null}

          {view.privateBankingClient ? (
            <div className="mt-5 rounded-lg border border-border/70 bg-surface-1/50 px-4 py-3 text-[14px]">
              Your Alta Private membership is active. Visit{" "}
              <Link to="/bank/private" className="font-medium text-foreground hover:underline">
                Alta Private
              </Link>{" "}
              for your private banking services.
            </div>
          ) : null}

          {privateClient.isMember ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <AltaPrivateMemberSinceCard context={privateClient} />
              <AltaPrivateBankerCard context={privateClient} />
            </div>
          ) : null}

          {privateClient.isMember ? (
            <AltaPrivateBenefitsHint context={privateClient} className="mt-5" linkToPrivate />
          ) : null}

          {view.opportunities.length > 0 ? (
            <div className="mt-5 space-y-2.5">
              <p className={RELATIONSHIP_METRIC_LABEL}>Opportunities</p>
              {view.opportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className="min-w-0 break-words rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-[14px]"
                >
                  {opportunity.message}
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </Section>

      <Section title="Lifetime activity" className={RELATIONSHIP_SECTION_GAP}>
        <Card className="min-w-0 max-w-full !p-5 sm:!p-6 hover:!border-border">
          <dl className={RELATIONSHIP_STAT_GRID}>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Deposits</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeDeposits)}
              </dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Withdrawals</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeWithdrawals)}
              </dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Alta Pay volume</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeAltaPayVolume)}
              </dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Interest earned</dt>
              <dd className={cn(RELATIONSHIP_METRIC_VALUE, "type-finance")}>
                {florin(view.lifetimeInterestEarned)}
              </dd>
            </div>
          </dl>
        </Card>
      </Section>

      <Section title="Your products" className={RELATIONSHIP_SECTION_GAP}>
        <Card className="min-w-0 max-w-full !p-5 sm:!p-6 hover:!border-border">
          <dl className={RELATIONSHIP_STAT_GRID}>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Bank accounts</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>{view.productsHeld.activeBankAccounts}</dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Active loans</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>{view.productsHeld.activeLoans}</dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Active Alta Cards</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>{view.productsHeld.activeAltaCards}</dd>
            </div>
            <div className={RELATIONSHIP_STAT_CELL}>
              <dt className={RELATIONSHIP_METRIC_LABEL}>Paid-off loans</dt>
              <dd className={RELATIONSHIP_METRIC_VALUE}>{view.productsHeld.paidOffLoans}</dd>
            </div>
          </dl>
        </Card>
      </Section>

      <Section title="Your relationship timeline" className="mt-10 sm:mt-11">
        <Card className="min-w-0 max-w-full !p-5 sm:!p-6 hover:!border-border">
          <RelationshipTimelineList
            events={view.timeline}
            emptyMessage="Milestones from your Alta products and activity will appear here as your relationship grows."
          />
        </Card>
      </Section>
    </>
  );
}
