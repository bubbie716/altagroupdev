import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { RouteButton } from "@/components/bank/route-button";
import { getLendingProducts } from "@/lib/bank/api";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/bank/lending/")({
  head: () => ({
    meta: [{ title: "Alta Bank Lending — Alta Group" }],
  }),
  component: BankLendingOverview,
});

function BankLendingOverview() {
  const lendingProducts = getLendingProducts();
  const user = useCurrentUser();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Lending"
      description="Credit facilities for Newport citizens, founders, and institutions — subject to manual underwriting review."
    >
      <BankSubNav />
      <LendingSubNav />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-2/30 px-5 py-4">
        <div>
          <p className="type-meta-accent">Credit applications</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Apply for a personal, business, or private liquidity line. All facilities are reviewed by Alta Bank staff.
          </p>
        </div>
        {user ? (
          <RouteButton
            to="/bank/lending/apply"
            className="rounded-md border border-gold/40 bg-gold/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold"
          >
            Apply for credit
          </RouteButton>
        ) : (
          <RouteButton
            to="/login"
            search={{ redirect: "/bank/lending/apply" }}
            className="rounded-md border border-gold/40 bg-gold/10 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-gold"
          >
            Sign in to apply
          </RouteButton>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lendingProducts.map((p) => (
          <Card key={p.name}>
            <div className="flex items-start justify-between gap-4">
              <div className="type-meta-accent">{p.name}</div>
              <span className="type-meta">
                {p.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="type-meta-sm">Limit</div>
                <div className="type-finance-md mt-1 font-medium">{p.limit}</div>
              </div>
              <div>
                <div className="type-meta-sm">Rate</div>
                <div className="type-finance-md mt-1 font-medium">{p.rate}</div>
              </div>
              <div className="col-span-2">
                <div className="type-meta-sm">Repayment</div>
                <div className="mt-1 font-medium">{p.repayment}</div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{p.summary}</p>
          </Card>
        ))}
      </div>

      <Section title="Monthly interest" className="mt-12">
        <Card>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Alta Bank lending uses monthly interest rates in V1. Interest accrues on outstanding balances once per
            month and may be applied manually by operators today, with automatic monthly accrual available via
            internal tools or cron in a future release. There is no automatic credit scoring, amortization schedule,
            or index-linked pricing.
          </p>
        </Card>
      </Section>

      <Section title="Manual review" className="mt-8">
        <Card>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Alta Bank lending is relationship-based and operator-reviewed. There is no automatic approval,
            credit scoring, or collateral automation in V1. Approved facilities may disburse Florins to a linked
            Alta account at operator discretion.
          </p>
        </Card>
      </Section>
    </PageShell>
  );
}
