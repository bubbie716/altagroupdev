import { Link } from "@tanstack/react-router";
import { AltaCardVisual } from "@/components/bank/alta-card/alta-card-visual";
import { AltaCardProductEyebrow } from "@/components/bank/alta-card/alta-card-ui-primitives";

export function AltaCardLandingHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-gold/8 via-transparent to-transparent" />
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative max-w-xl">
          <AltaCardProductEyebrow>Revolving credit · Alta Bank</AltaCardProductEyebrow>
          <h2 className="mt-3 font-serif text-[clamp(1.75rem,4vw,2.5rem)] leading-tight tracking-tight">
            A credit line designed for your Alta relationship
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Alta Card V1 is an intrabank revolving credit line inside Alta Bank — fund Alta Pay,
            request cash advances, and manage statement billing with relationship-based limits and
            rates. Card artwork is display-only; there is no merchant network or physical card
            processing in V1.
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
          : "Our team is reviewing your application. You can respond to requests and track progress in your secure deal room."}
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
