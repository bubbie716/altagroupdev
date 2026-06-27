import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { cn } from "@/lib/utils";

export type AltaPrivatePageContext = {
  isPrivateClient: boolean;
  altaCardId: string | null;
  bankerName: string | null;
  bankerTitle: string | null;
};

function PrivateCta({
  to,
  params,
  label,
  variant = "primary",
}: {
  to: string;
  params?: Record<string, string>;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
        variant === "primary"
          ? "border border-gold/50 bg-gold/[0.08] text-foreground hover:bg-gold/[0.14]"
          : "border border-border bg-transparent text-foreground hover:border-gold/40",
      )}
    >
      {label}
      <span aria-hidden className="text-gold">
        →
      </span>
    </Link>
  );
}

function BenefitList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3 text-[13px] leading-relaxed"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function EditorialBlock({
  intro,
  items,
  footnote,
  badge,
}: {
  intro: string;
  items?: string[];
  footnote?: string;
  badge?: string;
}) {
  return (
    <div className="max-w-3xl">
      {badge ? (
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
          <span className="size-1 rounded-full bg-gold" aria-hidden />
          {badge}
        </span>
      ) : null}
      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{intro}</p>
      {items?.length ? (
        <div className="mt-6">
          <BenefitList items={items} />
        </div>
      ) : null}
      {footnote ? (
        <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}

export function AltaGoldCardSection({ ctx }: { ctx: AltaPrivatePageContext }) {
  const benefits = [
    "Invitation-only · available through Alta Private",
    "Negotiated credit limits",
    "Negotiated interest rates",
    "Relationship pricing across your Alta accounts",
    "Dedicated banker support",
    "Priority servicing · reviewed by Alta Private",
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border border-gold/35 bg-surface-1">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-px w-20 bg-gold/60" />
        <div className="absolute left-0 top-0 h-20 w-px bg-gold/60" />
        <div className="absolute bottom-0 right-0 h-px w-20 bg-gold/60" />
        <div className="absolute bottom-0 right-0 h-20 w-px bg-gold/60" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_minmax(0,340px)] lg:gap-10">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Alta Private · Revolving credit
          </div>
          <h2 className="mt-4 font-serif text-[clamp(1.75rem,3vw,2.25rem)] leading-tight tracking-tight">
            Alta Gold Card
          </h2>
          <p className="mt-2 font-serif text-[17px] text-foreground/90">
            An invitation-only Alta Card tier available through Alta Private.
          </p>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Alta Gold is not a public card product. It is extended as part of your private
            banking relationship — with negotiated limits, relationship pricing, and banker-led
            review through Request Account Review.
          </p>

          {!ctx.isPrivateClient ? (
            <p className="mt-5 rounded-lg border border-border/70 bg-surface-2/50 px-4 py-3 text-[13px] leading-relaxed text-foreground/90">
              Alta Gold is available exclusively through Alta Private.
            </p>
          ) : null}

          <div className="mt-6">
            <BenefitList items={benefits} />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {ctx.isPrivateClient ? (
              ctx.altaCardId ? (
                <PrivateCta
                  to="/bank/alta-card/$cardId/review"
                  params={{ cardId: ctx.altaCardId }}
                  label="Request Alta Gold Review"
                />
              ) : (
                <>
                  <PrivateCta to="/bank/alta-card" label="Request Account Review" />
                  <a
                    href="#dedicated-banker"
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-transparent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:border-gold/40"
                  >
                    Discuss with Private Banking
                    <span aria-hidden className="text-gold">
                      →
                    </span>
                  </a>
                </>
              )
            ) : (
              <>
                <PrivateCta to="/bank/products" label="Learn about Alta Private" />
                <PrivateCta to="/bank/alta-card" label="Explore Alta Card" variant="secondary" />
              </>
            )}
          </div>

          <p className="mt-5 text-[12px] text-muted-foreground">
            All Alta Gold terms are subject to relationship review. Alta Private does not guarantee
            approval of requested limits, rates, or tier changes.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center border-t border-gold/20 bg-gold/[0.04] px-6 py-10 lg:border-l lg:border-t-0">
          <div className="w-full max-w-[300px]">
            <AltaCardVisual tier="gold" cardLastFour="0001" cardHolder="Private Client" responsive />
          </div>
          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Alta Gold · By relationship invitation
          </p>
        </div>
      </div>
    </div>
  );
}

export function RelationshipPricingSection() {
  return (
    <EditorialBlock
      badge="Relationship-based benefit"
      intro="Private clients may receive preferred pricing based on their total relationship with Alta — including bank balances, loan history, Alta Pay activity, business accounts, and future investment holdings. Pricing is reviewed with your dedicated banker; published tier defaults do not apply."
      items={[
        "Lower card rates",
        "Higher credit limits",
        "Preferred lending rates",
        "Custom repayment terms",
        "Priority underwriting",
      ]}
      footnote="Illustrative benefits only. Actual terms require relationship review and Alta Private approval."
    />
  );
}

export function NegotiatedLendingSection() {
  return (
    <EditorialBlock
      badge="Credit facility"
      intro="Alta Private clients may receive custom lending terms, larger credit facilities, flexible collateral review, and banker-assisted loan structuring — calibrated to the full relationship rather than a single product application."
      items={[
        "Personal lending",
        "Business lending",
        "Alta Card credit limits",
        "Future secured and portfolio-backed credit",
      ]}
      footnote="Facility size, collateral treatment, and pricing remain subject to underwriting and relationship review."
    />
  );
}

export function DedicatedBankerSection({ ctx }: { ctx: AltaPrivatePageContext }) {
  const hasBanker = Boolean(ctx.bankerName && ctx.bankerName !== "To be assigned");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)] lg:items-start">
      <EditorialBlock
        intro="Private clients receive relationship-managed support for banking, lending, payments, card reviews, and future capital markets services. Your dedicated banker coordinates across Alta Bank products — including Alta Gold requests submitted through Request Account Review."
        footnote="Coverage extends to treasury, lending, and card relationship reviews as your Alta profile grows."
      />
      <div className="rounded-lg border border-gold/30 bg-surface-1 p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Dedicated banker
        </div>
        {hasBanker ? (
          <>
            <p className="mt-4 font-serif text-2xl leading-tight tracking-tight">{ctx.bankerName}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{ctx.bankerTitle}</p>
            <p className="mt-5 border-t border-border/60 pt-4 text-[12px] text-muted-foreground">
              Direct line · relationship-managed correspondence
            </p>
          </>
        ) : ctx.isPrivateClient ? (
          <p className="mt-4 font-serif text-[17px] leading-snug tracking-tight text-foreground/85">
            Relationship assignment available for approved Alta Private clients.
          </p>
        ) : (
          <p className="mt-4 font-serif text-[17px] leading-snug tracking-tight text-foreground/85">
            Banker assignment follows Alta Private onboarding and relationship approval.
          </p>
        )}
      </div>
    </div>
  );
}

export function HigherTransferLimitsSection() {
  return (
    <EditorialBlock
      badge="Relationship-based benefit"
      intro="Alta Private clients may qualify for expanded transfer, payment, and Alta Pay limits based on account history and relationship review. Limits are not published as standard tiers — they reflect your standing with Alta Private."
      footnote="Transfer and payment ceilings are reviewed periodically. Contact your dedicated banker to discuss your relationship limits."
    />
  );
}

export function PriorityApplicationReviewSection() {
  return (
    <EditorialBlock
      badge="Priority review"
      intro="Alta Private clients receive priority review for Alta Card requests, loan applications, business banking requests, and future exchange and capital markets services — routed to relationship banking rather than standard queues."
      footnote="Priority review does not guarantee approval. Decisions remain subject to underwriting, compliance, and relationship standards."
    />
  );
}

export function BespokeFinancialServicesSection() {
  return (
    <EditorialBlock
      badge="Future · relationship-based"
      intro="Alta Private is building toward a broader suite of bespoke financial services for founding relationships — introduced by invitation as capabilities mature."
      items={[
        "Portfolio-backed credit",
        "Private placements",
        "Custom credit facilities",
        "Business treasury support",
        "Merchant and payment advisory",
        "Capital markets introductions",
      ]}
      footnote="Services marked as future or relationship-based are not yet generally available. Your banker will advise when eligible."
    />
  );
}
