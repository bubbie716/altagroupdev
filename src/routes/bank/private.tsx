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

const PLACEHOLDER = "—";

function BankPrivate() {
  const showMockData = isUserFinancialMockDataEnabled();
  const p = showMockData ? getPrivateBanking() : null;

  // Relationship overview values (placeholders when not available).
  const relationship = {
    status: p ? "Active" : "Pending Onboarding",
    since: p ? "March 2023" : PLACEHOLDER,
    tier: p?.tier ?? "Tier I · Founding Relationship",
    standing: p ? "Excellent · Founding Client" : "Awaiting first relationship review",
  };

  const wealth = {
    netWorth: PLACEHOLDER,
    banking: PLACEHOLDER,
    investments: PLACEHOLDER,
    lending: p?.liquidityLine ?? PLACEHOLDER,
  };

  return (
    <PageShell
      eyebrow="Alta Bank · Private"
      title="Alta Private"
      description="Reserved for Alta's most sophisticated clients."
    >
      <BankSubNav />

      {/* INVITATION RIBBON */}
      <div className="-mt-2 mb-10 flex flex-wrap items-center gap-4 border-y border-border/60 py-3 sm:mb-14">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          <span className="size-1 rounded-full bg-gold" aria-hidden />
          Invitation Only · Est. 2026
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Membership extended by referral
        </span>
      </div>

      {/* RELATIONSHIP OVERVIEW */}
      <PrivateSection
        index="01"
        title="Your relationship"
        kicker="At a glance"
        action={
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
            Refreshed daily · 09:00 ET
          </div>
        }
      >
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <DataCell label="Status" value={relationship.status} accent={!!p} />
          <DataCell label="Relationship since" value={relationship.since} />
          <DataCell label="Tier" value={relationship.tier} />
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
          <WealthCell label="Net worth" value={wealth.netWorth} note="Consolidated estimate" />
          <WealthCell label="Banking assets" value={wealth.banking} note="Deposits & money market" />
          <WealthCell label="Investments" value={wealth.investments} note="Equities, IPOs, holdings" />
          <WealthCell
            label="Lending exposure"
            value={wealth.lending}
            note="Approved facilities & utilization"
          />
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

      {/* CLIENT BENEFITS */}
      <PrivateSection
        index="05"
        title="Client benefits"
        kicker="What membership confers"
        className="mt-16 sm:mt-24"
      >
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          <BenefitCell
            n="i"
            title="Priority Review Processing"
            description="Deposits, withdrawals, and wire approvals routed to the front of the operator queue."
          />
          <BenefitCell
            n="ii"
            title="Enhanced Banking Limits"
            description="Elevated daily, monthly, and transfer ceilings calibrated to your relationship."
          />
          <BenefitCell
            n="iii"
            title="Private Lending Access"
            description="Direct access to portfolio-backed credit, business facilities, and bespoke structures."
          />
          <BenefitCell
            n="iv"
            title="Relationship Pricing"
            description="Negotiated yield, fee, and rate tiers reviewed quarterly with your banker."
          />
          <BenefitCell
            n="v"
            title="Founding Client Recognition"
            description="Permanent acknowledgement as an inaugural Alta Private relationship."
          />
          <BenefitCell
            n="vi"
            title="Early Product Access"
            description="Preview new Alta Bank, Exchange, and Terminal capabilities before public release."
          />
        </div>
      </PrivateSection>

      {/* OPPORTUNITIES & OFFERS */}
      <PrivateSection
        index="06"
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
          <OpportunityCard
            tag="Banking"
            title="Exclusive Promotions"
            body="Negotiated incentives on Reserve, Summit, and lending products as they are introduced."
          />
          <OpportunityCard
            tag="Platform"
            title="Early Platform Access"
            body="Preview new Alta capabilities — terminals, instruments, and reporting — before launch."
          />
          <OpportunityCard
            tag="Concierge"
            title="Bespoke Engagements"
            body="Specialty requests across treasury, custody, and structured banking by appointment."
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
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-between bg-surface-1 px-5 py-5 sm:px-6 sm:py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-4 font-serif text-xl tracking-tight sm:text-2xl",
          accent && "text-foreground",
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
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between bg-surface-1 px-5 py-6 sm:px-6 sm:py-7">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="tabular mt-5 font-serif text-3xl leading-none tracking-tight">{value}</div>
      <div className="mt-3 text-[12px] text-muted-foreground">{note}</div>
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

function BenefitCell({
  n,
  title,
  description,
}: {
  n: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-surface-1 px-6 py-6">
      <div className="flex items-baseline gap-3">
        <span className="font-serif text-base italic text-gold">{n}.</span>
        <h3 className="font-serif text-lg leading-tight tracking-tight">{title}</h3>
      </div>
      <p className="mt-3 pl-7 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
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
