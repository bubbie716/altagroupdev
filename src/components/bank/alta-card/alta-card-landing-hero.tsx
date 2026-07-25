import { Link } from "@tanstack/react-router";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { AltaCardProductEyebrow } from "@/components/bank/alta-card/alta-card-ui-primitives";
import { ALTA_CARD_APPLICATION_PENDING_BODY } from "@/lib/bank/bank-shared-copy";

export function AltaCardLandingHero() {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-1">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-gold/8 via-transparent to-transparent" />
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative max-w-xl">
          <AltaCardProductEyebrow>Revolving credit · Alta Bank</AltaCardProductEyebrow>
          <h2 className="mt-3 font-serif text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
            A credit line designed for your Alta relationship
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Alta Card is an intrabank revolving credit line inside Alta Bank — fund Alta Pay,
            request cash advances, and manage statement billing with relationship-based limits and
            rates. Card artwork is for display; merchant network and physical card processing are not
            included.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/bank/alta-card/apply"
              className="rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
            >
              Apply for Alta Card
            </Link>
            <Link
              to="/bank/alta-card/business"
              className="rounded-md border border-border bg-surface-2 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em]"
            >
              Business cards
            </Link>
          </div>
        </div>
        <div className="relative mx-auto lg:mx-0">
          <AltaCardVisual tier="navy" cardHolder="Cardholder" responsive />
          <div className="absolute -bottom-3 -left-3 -z-10 hidden sm:block">
            <AltaCardVisual tier="black" cardHolder="Cardholder" compact width={200} className="opacity-60" />
          </div>
        </div>
      </div>
    </div>
  );
}

const ALTA_GOLD_BENEFITS = [
  "Negotiated credit limits",
  "Negotiated interest rates",
  "Relationship pricing across your Alta accounts",
  "Priority servicing on card requests",
  "Reviewed by the Alta credit desk",
  "Terms revisited through Request Account Review",
];

export function AltaGoldCardHighlight({ cardId }: { cardId?: string | null }) {
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
          <AltaCardProductEyebrow>Alta Gold · Revolving credit</AltaCardProductEyebrow>
          <h2 className="mt-4 font-serif text-[clamp(1.75rem,3vw,2.25rem)] leading-tight tracking-tight">
            Alta Gold Card
          </h2>
          <p className="mt-2 font-serif text-[17px] text-foreground/90">
            The flagship Alta Card tier, priced to your full Alta Bank relationship.
          </p>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Alta Gold has no published limit or rate. Terms are set by the Alta credit desk based on
            your balances, loan history, and payment record — and can be revisited at any time
            through Request Account Review.
          </p>

          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {ALTA_GOLD_BENEFITS.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3 text-[13px] leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            {cardId ? (
              <Link
                to="/bank/alta-card/$cardId/review"
                params={{ cardId }}
                className="rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-gold/[0.14]"
              >
                Request Alta Gold review
              </Link>
            ) : (
              <Link
                to="/bank/alta-card/apply"
                className="rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] hover:bg-gold/[0.14]"
              >
                Apply for Alta Gold
              </Link>
            )}
          </div>

          <p className="mt-5 text-[12px] text-muted-foreground">
            All Alta Gold terms are subject to credit review. Alta Bank does not guarantee approval
            of requested limits, rates, or tier changes.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center border-t border-gold/20 bg-gold/[0.04] px-6 py-10 lg:border-l lg:border-t-0">
          <div className="w-full max-w-[300px]">
            <AltaCardVisual tier="gold" cardLastFour="0001" cardHolder="Cardholder" responsive />
          </div>
          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Alta Gold · Negotiated terms
          </p>
        </div>
      </div>
    </div>
  );
}

export function AltaCardPersonalVsBusiness() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface-1/80 p-5">
        <p className="font-serif text-[18px]">Personal Alta Card</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          One revolving credit line per cardholder. Fund Alta Pay, request cash advances, and make
          payments from your personal line within Alta Bank.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-surface-1/80 p-5">
        <p className="font-serif text-[18px]">Business Alta Card</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Company credit line with employee cards authorized against available credit. Treasury
          managers control employee limits and card status.
        </p>
      </div>
    </div>
  );
}

export function AltaCardPendingApplicationBanner({
  statusLabel,
  applicationId,
  cardType = "personal",
  status,
  companyName,
}: {
  statusLabel: string;
  applicationId: string;
  cardType?: "personal" | "business";
  status?: string;
  companyName?: string | null;
}) {
  const applicationTo =
    cardType === "business"
      ? "/bank/alta-card/business/applications/$applicationId"
      : "/bank/alta-card/applications/$applicationId";
  const isApproved = status === "approved";
  const title =
    cardType === "business" && companyName
      ? `${companyName} Alta Card application`
      : "Your Alta Card application";

  return (
    <div className="rounded-xl border border-gold/30 bg-gold/5 p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
        {isApproved ? "Application approved" : "Application in review"}
      </p>
      <h3 className="mt-2 font-serif text-[20px]">{title}</h3>
      <p className="mt-2 text-[14px] text-muted-foreground">
        Status: <span className="text-foreground">{statusLabel}</span>
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {isApproved
          ? "Review your approved terms and accept your card to activate the business credit line."
          : ALTA_CARD_APPLICATION_PENDING_BODY}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={applicationTo}
          params={{ applicationId }}
          className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background"
        >
          {isApproved ? "Review & accept" : "View application"}
        </Link>
      </div>
    </div>
  );
}
