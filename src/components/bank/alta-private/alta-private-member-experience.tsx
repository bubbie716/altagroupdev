import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { CustomerRelationshipView } from "@/lib/bank/relationship-intelligence-types";
import {
  AltaGoldCardSection,
  BespokeFinancialServicesSection,
  DedicatedBankerSection,
  HigherTransferLimitsSection,
  NegotiatedLendingSection,
  PriorityApplicationReviewSection,
  RelationshipPricingSection,
  type AltaPrivatePageContext,
} from "@/components/bank/alta-private/alta-private-benefits";
import { florin } from "@/lib/bank/api";
import { cn } from "@/lib/utils";

export function AltaPrivateMemberExperience({
  ctx,
  relationshipView,
}: {
  ctx: AltaPrivatePageContext;
  relationshipView: CustomerRelationshipView | null;
}) {
  const tierLabel = relationshipView?.relationshipTierLabel ?? "—";
  const assets = relationshipView ? florin(relationshipView.totalAltaAssets) : "—";

  return (
    <div className="space-y-16 sm:space-y-24">
      <div className="rounded-xl border border-gold/30 bg-gold/5 px-5 py-4 text-[14px]">
        Alta Private Client — relationship-managed banking with negotiated credit, preferred pricing, and priority review.
      </div>

      <section className="rounded-xl border border-gold/30 bg-surface-1 p-6 sm:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Private Client Status</p>
        <h2 className="mt-3 font-serif text-3xl tracking-tight">Alta Private Membership</h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MemberStat label="Alta Private" value="Active" accent />
          <MemberStat label="Relationship tier" value={tierLabel} />
          <MemberStat label="Total Alta assets" value={assets} />
        </dl>
      </section>

      <PrivateSection index="01" title="Alta Gold Card Eligibility" kicker="Private client benefit">
        <AltaGoldCardSection ctx={ctx} />
      </PrivateSection>

      <PrivateSection index="02" title="Relationship pricing" kicker="Reviewed with your banker">
        <RelationshipPricingSection />
      </PrivateSection>

      <PrivateSection index="03" title="Private lending & liquidity" kicker="Custom credit facilities">
        <NegotiatedLendingSection />
      </PrivateSection>

      <PrivateSection index="04" title="Dedicated banker" kicker="Relationship-managed support" id="dedicated-banker">
        <DedicatedBankerSection ctx={ctx} />
      </PrivateSection>

      <PrivateSection index="05" title="Higher transfer limits" kicker="Treasury & payments">
        <HigherTransferLimitsSection />
      </PrivateSection>

      <PrivateSection index="06" title="Priority review" kicker="Front-of-queue routing">
        <PriorityApplicationReviewSection />
      </PrivateSection>

      <PrivateSection index="07" title="Bespoke services" kicker="Coordinated through Alta">
        <BespokeFinancialServicesSection />
        <p className="mt-4 text-[13px] text-muted-foreground">
          Bespoke services are coordinated directly through Alta.
        </p>
      </PrivateSection>

      <div className="border-t border-border/60 pt-6">
        <Link
          to="/bank/relationship"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold hover:underline"
        >
          View relationship timeline →
        </Link>
      </div>
    </div>
  );
}

function MemberStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-2 font-serif text-xl tracking-tight", accent && "text-gold")}>{value}</dd>
    </div>
  );
}

function PrivateSection({
  index,
  title,
  kicker,
  className,
  id,
  children,
}: {
  index: string;
  title: string;
  kicker?: string;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className={className} id={id}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{index}</span>
          <div>
            {kicker ? (
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kicker}
              </div>
            ) : null}
            <h2 className="mt-1 font-serif text-2xl tracking-tight sm:text-3xl">{title}</h2>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
