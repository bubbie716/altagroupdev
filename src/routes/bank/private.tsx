import { createFileRoute } from "@tanstack/react-router";
import { privateClientBeforeLoad } from "@/lib/auth/guards";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankStatCard } from "@/components/bank/bank-stat-card";
import { PrivateTierCard } from "@/components/bank/private-tier-card";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import CreditCard from "@/components/shared-assets/credit-card/credit-card";
import { getPrivateBanking, getPrivateMetrics } from "@/lib/bank/api";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

export const Route = createFileRoute("/bank/private")({
  beforeLoad: privateClientBeforeLoad,
  head: () => ({
    meta: [{ title: "Alta Private — Alta Bank" }],
  }),
  component: BankPrivate,
});

function BankPrivate() {
  const showMockData = isUserFinancialMockDataEnabled();

  return (
    <PageShell
      eyebrow="Alta Bank · Private"
      title="Invitation Only"
      description="Alta Private is invitation-only private banking within Alta Bank, reserved for Newport's most influential individuals, founders, institutions, and high-balance clients."
    >
      <BankSubNav />

      {showMockData ? <BankPrivateMockContent /> : <BankPrivateLockedContent />}
    </PageShell>
  );
}

function BankPrivateLockedContent() {
  return (
    <>
      <EmptyBankState
        title="No Alta Private relationship on file."
        description="Your private banking profile, dedicated banker, and account status will appear here once your Alta Private relationship is established."
        ctaLabel="View Bank Products"
        ctaTo="/bank/products"
      />

      <Section title="Private Benefits" className="mt-12">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
          {[
            "Dedicated private banker",
            "Same-day NCC-Net wire priority",
            "Reserve Account by Alta Private",
            "Summit Money Market by Alta Private",
            "Concierge settlement support",
            "Integrated Alta Exchange Terminal access",
          ].map((item) => (
            <div key={item} className="bg-surface-1 px-6 py-4 text-[14px]">
              {item}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function BankPrivateMockContent() {
  const p = getPrivateBanking();
  const privateMetrics = getPrivateMetrics();

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {privateMetrics.map((m) => (
          <BankStatCard key={m.label} label={m.label} value={m.value} />
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
        <Card className="border-gold/20 bg-surface-1">
          <div className="type-eyebrow">Alta Private</div>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Alta Private is invitation-only private banking within Alta Bank, reserved for Newport's most
            influential individuals, founders, institutions, and high-balance clients. Membership is
            extended by referral — not open for public application.
          </p>
          <div className="mt-6 inline-flex rounded-full border border-border px-3 py-1 type-meta">
            Applications closed — access extended by invitation only
          </div>
        </Card>
        <CreditCard
          type="gray-dark"
          width={340}
          company="Alta Private"
          cardNumber="4921 ···· ···· 8842"
          cardHolder="Whitford Family Office"
          cardExpiration="09/29"
        />
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <PrivateTierCard label="Private Banker" value={p.banker} detail={p.bankerTitle} />
        <PrivateTierCard label="Relationship Tier" value={p.tier} />
        <PrivateTierCard label="Private Card" value={p.card} detail={p.cardLimit} />
        <PrivateTierCard label="Priority Lending" value={p.lending} />
        <PrivateTierCard
          label="Summit Money Market"
          value="Active relationship"
          detail={p.summitMoneyMarket}
        />
        <PrivateTierCard label="Liquidity Line" value={p.liquidityLine} />
        <PrivateTierCard label="Invitation-Only Access" value="By referral" detail="Not open for public application" />
      </div>

      <Section title="Private Benefits" className="mt-12">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
          {[
            "Dedicated private banker",
            "Same-day NCC-Net wire priority",
            "Reserve Account by Alta Private",
            "Summit Money Market by Alta Private",
            "Concierge settlement support",
            "Integrated Alta Exchange Terminal access",
          ].map((item) => (
            <div key={item} className="bg-surface-1 px-6 py-4 text-[14px]">
              {item}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
