import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { privateClientBeforeLoad } from "@/lib/auth/guards";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { getPrivateBanking } from "@/lib/bank/api";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bank/private")({
  beforeLoad: privateClientBeforeLoad,
  head: () => ({
    meta: [{ title: "Alta Private — Reserved for Alta's most sophisticated clients" }],
  }),
  component: BankPrivate,
});

function BankPrivate() {
  const showMockData = isUserFinancialMockDataEnabled();
  const p = showMockData ? getPrivateBanking() : null;

  // Intentional placeholders — never expose a raw dash.
  const PENDING = "Pending Relationship Review";

  const relationship = {
    status: p ? "Active" : "Pending Onboarding",
    since: p ? "March 2023" : PENDING,
    activeProducts: p ? "4 · Reserve, Summit, Liquidity, Custody" : PENDING,
    relationshipValue: p ? "Tier I" : PENDING,
    tier: p?.tier ?? "Tier I · Founding Relationship",
    standing: p ? "Excellent · Founding Client" : "Awaiting first relationship review",
  };

  const wealth: { label: string; value: string | null; note: string; fallback: string }[] = [
    {
      label: "Net worth",
      value: null,
      note: "Consolidated estimate",
      fallback: "Connect additional Alta products to unlock.",
    },
    {
      label: "Banking assets",
      value: null,
      note: "Deposits & money market",
      fallback: "Aggregates with your next statement cycle.",
    },
    {
      label: "Investments",
      value: null,
      note: "Equities, IPOs, holdings",
      fallback: "Requires Alta Exchange portfolio integration.",
    },
    {
      label: "Lending exposure",
      value: p?.liquidityLine ?? null,
      note: "Approved facilities & utilization",
      fallback: "No active facilities.",
    },
  ];

  return (
    <PageShell
      eyebrow="Alta Bank · Private"
      title="Alta Private"
      description="Reserved for Alta's most sophisticated clients."
    >
      <BankSubNav />

      {/* HERO RELATIONSHIP CARD */}
      <HeroRelationshipCard />

      {/* RELATIONSHIP OVERVIEW */}
      <PrivateSection
        index="01"
        title="Your relationship"
        kicker="At a glance"
        className="mt-16 sm:mt-24"
        action={
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
            Refreshed daily · 09:00 ET
          </div>
        }
      >
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          <DataCell label="Status" value={relationship.status} accent={!!p} />
          <DataCell label="Private client since" value={relationship.since} muted={!p} />
          <DataCell label="Active products" value={relationship.activeProducts} muted={!p} />
          <DataCell label="Relationship tier" value={relationship.tier} />
          <DataCell label="Banking relationship value" value={relationship.relationshipValue} muted={!p} />
          <DataCell label="Client standing" value={relationship.standing} />
        </div>
      </PrivateSection>

      {/* RELATIONSHIP MANAGEMENT */}
      <PrivateSection
        index="02"
        title="Relationship management"
        kicker="Your team"
        className="mt-16 sm:mt-24"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <ContactCard
            role="Dedicated Banker"
            name={p?.banker ?? "To be assigned"}
            title={p?.bankerTitle ?? "Managing Director · Private Banking"}
            availability="Direct line · same-day response"
          />
          <ContactCard
            role="Relationship Manager"
            name="To be assigned"
            title="Vice President · Client Coverage"
            availability="Quarterly portfolio reviews"
          />
          <ContactCard
            role="Private Banking Team"
            name="Newport Private Group"
            title="Concierge, lending & treasury specialists"
            availability="Mon–Fri · 07:00–19:00 ET"
          />
        </div>
      </PrivateSection>

      {/* ALTA PRIVATE CHARTER */}
      <CharterSection />

      {/* WEALTH OVERVIEW */}
      <PrivateSection
        index="03"
        title="Wealth overview"
        kicker="Consolidated position"
        className="mt-16 sm:mt-24"
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            All figures in ƒ
          </span>
        }
      >
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {wealth.map((w) => (
            <WealthCell key={w.label} {...w} />
          ))}
        </div>
        <p className="mt-4 text-[12px] text-muted-foreground">
          Wealth aggregates appear here as your portfolio is connected. Discuss reporting cadence
          with your dedicated banker.
        </p>
      </PrivateSection>

      {/* EXCLUSIVE PRODUCTS */}
      <PrivateSection
        index="04"
        title="Exclusive products"
        kicker="By Alta Private"
        className="mt-16 sm:mt-24"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <ProductCard
            name="Reserve Account"
            tagline="by Alta Private"
            description="A premium store-of-value account engineered for substantial Florin reserves with enhanced limits and white-glove servicing."
            attributes={[
              ["Minimum balance", "ƒ250,000"],
              ["Wire priority", "Same-day · NCC-Net"],
              ["Statements", "Bespoke, quarterly"],
            ]}
          />
          <ProductCard
            name="Summit Money Market"
            tagline="by Alta Private"
            description="A relationship money-market vehicle with negotiated yield tiers and discretionary liquidity windows curated by your banker."
            attributes={[
              ["Yield model", "Relationship-priced"],
              ["Liquidity", "On-demand transfers"],
              ["Access", p ? "Active relationship" : "By invitation"],
            ]}
            featured
          />
          <ProductCard
            name="Private Liquidity Line"
            tagline="Standby credit facility"
            description="An approved-but-undrawn line backed by portfolio assets — capital ready the moment opportunity moves faster than approval queues."
            attributes={[
              ["Status", p ? "Approved · Undrawn" : "Eligibility review"],
              ["Pricing", "Relationship rate"],
              ["Draw", "Same-day intrabank"],
            ]}
          />
        </div>
      </PrivateSection>

      {/* CLIENT BENEFITS — premium cards */}
      <PrivateSection
        index="05"
        title="Client benefits"
        kicker="What membership confers"
        className="mt-16 sm:mt-24"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <BenefitCard
            n="i"
            tag="Operations"
            title="Priority Review Processing"
            description="Deposits, withdrawals, and wire approvals routed to the front of the operator queue."
          />
          <BenefitCard
            n="ii"
            tag="Treasury"
            title="Enhanced Banking Limits"
            description="Elevated daily, monthly, and transfer ceilings calibrated to your relationship."
          />
          <BenefitCard
            n="iii"
            tag="Credit"
            title="Private Lending Access"
            description="Direct access to portfolio-backed credit, business facilities, and bespoke structures."
          />
          <BenefitCard
            n="iv"
            tag="Pricing"
            title="Relationship Pricing"
            description="Negotiated yield, fee, and rate tiers reviewed quarterly with your banker."
          />
          <BenefitCard
            n="v"
            tag="Recognition"
            title="Founding Client Recognition"
            description="Permanent acknowledgement as an inaugural Alta Private relationship."
          />
          <BenefitCard
            n="vi"
            tag="Platform"
            title="Early Product Access"
            description="Preview new Alta Bank, Exchange, and Terminal capabilities before public release."
          />
        </div>
      </PrivateSection>

      {/* PRIVATE CLIENT OFFERS */}
      <PrivateSection
        index="06"
        title="Private client offers"
        kicker="Exclusive benefits from Alta & partners"
        className="mt-16 sm:mt-24"
      >
        <OfferGroup heading="Alta Private exclusive">
          <OfferCard
            badge="Alta Private"
            partner="Reserve Account"
            title="Account fee waivers"
            body="Maintenance, wire, and statement fees waived for the life of the relationship."
          />
          <OfferCard
            badge="Private Client Only"
            partner="Summit Money Market"
            title="Preferred yield terms"
            body="Negotiated rate tier above standard published yields, reviewed quarterly."
          />
          <OfferCard
            badge="Member Benefit"
            partner="Alta Exchange"
            title="Priority IPO allocation access"
            body="Allocation windows ahead of public order books for select Alta Exchange listings."
          />
          <OfferCard
            badge="Exclusive"
            partner="Private Liquidity Line"
            title="Review priority"
            body="Front-of-queue underwriting for new and expanded facility requests."
          />
        </OfferGroup>

        <OfferGroup heading="Partner benefits" className="mt-10">
          <OfferCard
            badge="Partner"
            partner="Newport Tavern"
            title="67% off one side with entrée"
            body="Extended at the discretion of the house. Present membership at the door."
          />
          <OfferCard
            badge="Partner"
            partner="Harbor Logistics"
            title="Priority commercial processing"
            body="Expedited freight scheduling and dedicated coverage for Alta Private accounts."
          />
          <OfferCard
            badge="Partner"
            partner="Redmont Aviation"
            title="Private member charter discounts"
            body="Negotiated rates on Redmont charter inventory and empty-leg priority access."
          />
          <OfferCard
            badge="Partner"
            partner="Alta Exchange"
            title="Priority access to select offerings"
            body="Pre-listing previews of curated Newport company placements."
          />
        </OfferGroup>
      </PrivateSection>

      {/* PRIVATE CLIENT NETWORK */}
      <PrivateSection
        index="07"
        title="Private client network"
        kicker="Access to people, not just products"
        className="mt-16 sm:mt-24"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NetworkCard
            tag="Founder roundtables"
            title="Closed-room conversations"
            body="Quarterly gatherings with Newport founders and Alta leadership. Invitation by relationship."
          />
          <NetworkCard
            tag="Private economic briefings"
            title="Newport market reads"
            body="Discreet briefings from Alta's research desk ahead of public commentary."
          />
          <NetworkCard
            tag="Capital introductions"
            title="Quiet placements"
            body="Curated introductions between members raising and members allocating capital."
          />
          <NetworkCard
            tag="Business networking"
            title="Curated salons"
            body="Small-format dinners across Newport with operators in your sector and stage."
          />
          <NetworkCard
            tag="Leadership discussions"
            title="Off-the-record forums"
            body="Sessions with founders, governors, and operators on matters not yet public."
          />
          <NetworkCard
            tag="Bespoke engagements"
            title="By appointment"
            body="Custom convenings — boards, advisors, families — at the request of a member."
          />
        </div>
      </PrivateSection>

      {/* OPPORTUNITIES */}
      <PrivateSection
        index="08"
        title="Client opportunities"
        kicker="Curated, discreet, limited"
        className="mt-16 sm:mt-24"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <OpportunityCard
            tag="Capital Markets"
            title="Priority IPO Access"
            body="Allocation windows ahead of public order books for select Alta Exchange listings."
          />
          <OpportunityCard
            tag="Private Markets"
            title="Private Offerings"
            body="Curated placements in Newport companies not available through retail channels."
          />
          <OpportunityCard
            tag="Membership"
            title="Founding Client Programs"
            body="Closed-door briefings, governance previews, and Alta leadership roundtables."
          />
        </div>
      </PrivateSection>

      {/* DISCREET FOOTNOTE */}
      <div className="mt-20 border-t border-border/60 pt-6 sm:mt-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Alta Private
            </div>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Alta Private is an invitation-only relationship within Alta Bank. Membership is
              extended by referral. All figures and product terms are subject to your relationship
              agreement and operator approval.
            </p>
          </div>
          <Link
            to="/bank/products"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground underline-offset-4 hover:text-gold hover:underline"
          >
            View Alta Bank product suite →
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

/* ---------- Layout primitives ---------- */

function HeroRelationshipCard() {
  return (
    <div className="relative -mt-2 mb-12 overflow-hidden rounded-xl border border-gold/30 bg-surface-1 sm:mb-16">
      {/* Hairline gold corner accents */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-0 h-px w-16 bg-gold/60" />
        <div className="absolute left-0 top-0 h-16 w-px bg-gold/60" />
        <div className="absolute right-0 bottom-0 h-px w-16 bg-gold/60" />
        <div className="absolute right-0 bottom-0 h-16 w-px bg-gold/60" />
      </div>

      <div className="grid gap-px bg-border/60 sm:grid-cols-[1.4fr_1fr]">
        <div className="bg-surface-1 px-6 py-8 sm:px-10 sm:py-12">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <PrestigeBadge>Invitation Only</PrestigeBadge>
            <PrestigeBadge tone="muted">Founding Client</PrestigeBadge>
            <PrestigeBadge tone="muted">Est. 2026</PrestigeBadge>
          </div>
          <h2 className="mt-6 font-serif text-3xl leading-[1.05] tracking-tight sm:text-[40px]">
            Alta Private Relationship
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Reserved for clients requiring bespoke banking, lending, treasury, and capital
            markets access. Membership is extended by invitation and maintained through active
            participation in the Alta financial ecosystem.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              className="group inline-flex items-center gap-2 rounded-md border border-gold/50 bg-gold/[0.08] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-gold/[0.14]"
            >
              Speak with your banker
              <span aria-hidden className="text-gold transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-transparent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground transition-colors hover:border-gold/40"
            >
              View membership benefits
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between bg-surface-1 px-6 py-8 sm:px-8 sm:py-12">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Relationship signature
            </div>
            <div className="mt-5 space-y-4">
              <HeroStat label="Membership" value="Alta Private" />
              <HeroStat label="Standing" value="Founding Client" />
              <HeroStat label="Tier" value="Tier I" />
              <HeroStat label="Coverage" value="Newport Private Group" />
            </div>
          </div>
          <div className="mt-8 border-t border-border/60 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Relationship managed · Discretion assured
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className="font-serif text-[15px] tracking-tight text-foreground">{value}</span>
    </div>
  );
}

function CharterSection() {
  return (
    <section className="mt-20 border-y border-border/60 py-16 sm:mt-28 sm:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          <span className="size-1 rounded-full bg-gold" aria-hidden />
          The Alta Private Charter
        </div>
        <p className="mt-8 font-serif text-2xl leading-[1.35] tracking-tight text-foreground sm:text-[32px]">
          Alta Private exists to provide relationship-based banking, lending, treasury services,
          and capital markets access to Newport's most sophisticated individuals and institutions.
        </p>
        <p className="mt-8 font-serif text-xl leading-[1.45] tracking-tight text-muted-foreground sm:text-2xl">
          Membership is extended by invitation and maintained through active participation in the
          Alta financial ecosystem.
        </p>
        <div className="mt-10 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          — Office of the Chief Executive · Alta Bank
        </div>
      </div>
    </section>
  );
}

function PrestigeBadge({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]",
        tone === "gold" ? "text-gold" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          tone === "gold" ? "bg-gold" : "bg-muted-foreground/50",
        )}
        aria-hidden
      />
      {children}
    </span>
  );
}

function PrivateSection({
  index,
  title,
  kicker,
  action,
  className,
  children,
}: {
  index: string;
  title: string;
  kicker?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-4 sm:mb-8">
        <div className="flex items-baseline gap-4 sm:gap-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
            {index}
          </span>
          <div className="min-w-0">
            {kicker && (
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kicker}
              </div>
            )}
            <h2 className="mt-1 font-serif text-2xl tracking-tight sm:text-3xl">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function DataCell({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-between bg-surface-1 px-5 py-5 sm:px-6 sm:py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-4 font-serif text-lg leading-tight tracking-tight sm:text-xl",
          accent && "text-foreground",
          muted && "text-muted-foreground italic",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function WealthCell({
  label,
  value,
  note,
  fallback,
}: {
  label: string;
  value: string | null;
  note: string;
  fallback: string;
}) {
  const hasValue = value !== null && value !== "—";
  return (
    <div className="flex h-full flex-col justify-between bg-surface-1 px-5 py-6 sm:px-6 sm:py-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      {hasValue ? (
        <>
          <div className="tabular mt-5 font-serif text-3xl leading-none tracking-tight">
            {value}
          </div>
          <div className="mt-3 text-[12px] text-muted-foreground">{note}</div>
        </>
      ) : (
        <>
          <div className="mt-5 font-serif text-[15px] leading-snug tracking-tight text-foreground/80">
            {fallback}
          </div>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {note}
          </div>
        </>
      )}
    </div>
  );
}

function ContactCard({
  role,
  name,
  title,
  availability,
}: {
  role: string;
  name: string;
  title: string;
  availability: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface-1 p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{role}</div>
      <div className="mt-5 flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/[0.06] font-serif text-base tracking-wide text-foreground">
          {initials || "—"}
        </div>
        <div className="min-w-0">
          <div className="truncate font-serif text-lg leading-tight">{name}</div>
          <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{title}</div>
        </div>
      </div>
      <div className="mt-6 border-t border-border/60 pt-4 text-[12px] text-muted-foreground">
        {availability}
      </div>
      <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Request introduction</span>
        <span aria-hidden>→</span>
      </div>
    </div>
  );
}

function ProductCard({
  name,
  tagline,
  description,
  attributes,
  featured,
}: {
  name: string;
  tagline: string;
  description: string;
  attributes: [string, string][];
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border bg-surface-1 p-6 transition-colors",
        featured ? "border-gold/40" : "border-border",
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{tagline}</div>
      <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight">{name}</h3>
      <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      <dl className="mt-6 grid gap-3 border-t border-border/60 pt-5">
        {attributes.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {k}
            </dt>
            <dd className="tabular text-right text-[13px] text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Speak with your banker</span>
        <span aria-hidden>→</span>
      </div>
    </div>
  );
}

function BenefitCard({
  n,
  tag,
  title,
  description,
}: {
  n: string;
  tag: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex h-full flex-col rounded-lg border border-border bg-surface-1 p-6 transition-colors hover:border-gold/40 sm:p-7">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{tag}</span>
        <span className="font-serif text-base italic text-gold/80">{n}.</span>
      </div>
      <h3 className="mt-6 font-serif text-xl leading-tight tracking-tight sm:text-[22px]">
        {title}
      </h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-auto pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        Member benefit
      </div>
    </div>
  );
}

function OfferGroup({
  heading,
  children,
  className,
}: {
  heading: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span className="h-px flex-none w-6 bg-gold/60" aria-hidden />
        {heading}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function OfferCard({
  badge,
  partner,
  title,
  body,
}: {
  badge: string;
  partner: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group flex h-full flex-col rounded-lg border border-border bg-surface-1 p-6 transition-colors hover:border-gold/40">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/[0.06] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-gold">
          {badge}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {partner}
        </span>
      </div>
      <h3 className="mt-5 font-serif text-lg leading-tight tracking-tight sm:text-xl">{title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Redeem through your banker →
      </div>
    </div>
  );
}

function NetworkCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface-1 p-6 transition-colors hover:border-gold/40">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{tag}</div>
      <h3 className="mt-4 font-serif text-lg leading-tight tracking-tight sm:text-xl">{title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-auto pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Priority access · Invitation only
      </div>
    </div>
  );
}

function OpportunityCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group flex h-full flex-col rounded-lg border border-border bg-surface-1 p-6 transition-colors hover:border-gold/40">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{tag}</span>
        <span className="text-gold">By invitation</span>
      </div>
      <h3 className="mt-5 font-serif text-xl leading-tight tracking-tight">{title}</h3>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
