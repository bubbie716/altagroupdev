import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
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
      eyebrow="Alta Bank · Credit Desk"
      title="Lending"
      description="Relationship-led credit facilities for Newport citizens, founders, and institutions — every facility manually reviewed by Alta Bank credit operations."
    >
      <BankSubNav />
      <LendingSubNav />

      {/* Editorial CTA strip */}
      <div className="mb-12 overflow-hidden rounded-xl border border-border bg-surface-1/80">
        <div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-10 sm:px-8">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Credit applications · open
            </p>
            <h2 className="mt-3 font-serif text-[28px] leading-[1.1] tracking-tight sm:text-[34px]">
              Speak to the Alta credit desk.
            </h2>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              Personal, business, and private liquidity lines structured one
              facility at a time. No automated decisioning — a credit officer is
              assigned the moment you apply.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {user ? (
              <RouteButton
                to="/bank/lending/apply"
                className="rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background hover:bg-foreground/90"
              >
                Apply for credit
              </RouteButton>
            ) : (
              <RouteButton
                to="/login"
                search={{ redirect: "/bank/lending/apply" }}
                className="rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background hover:bg-foreground/90"
              >
                Sign in to apply
              </RouteButton>
            )}
            <Link
              to="/bank/lending/applications"
              className="rounded-md border border-border bg-surface-2/60 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:bg-surface-2"
            >
              My applications
            </Link>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        <dl className="grid grid-cols-2 divide-x divide-border/60 sm:grid-cols-4">
          {[
            { label: "Officers on desk", value: "12" },
            { label: "Avg. response", value: "< 4h" },
            { label: "Active facilities", value: "287" },
            { label: "Approval review", value: "Manual" },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-1 font-serif text-[20px] tracking-tight">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Section
        title="Credit products"
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {lendingProducts.length} facilities
          </span>
        }
      >
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {lendingProducts.map((p) => (
            <article
              key={p.name}
              className="group flex flex-col bg-surface-1 p-6 transition-colors hover:bg-surface-1/60"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-serif text-[20px] leading-tight tracking-tight">
                  {p.name}
                </h3>
                <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  {p.status}
                </span>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-y-4 gap-x-6">
                <Spec label="Limit" value={p.limit} />
                <Spec label="Rate" value={p.rate} />
                <div className="col-span-2">
                  <Spec label="Repayment" value={p.repayment} />
                </div>
              </dl>

              <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
                {p.summary}
              </p>

              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
                <Link
                  to="/bank/lending/apply"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold hover:text-foreground"
                >
                  Start application →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section className="mt-16">
        <div className="grid gap-6 md:grid-cols-2">
          <Pillar
            kicker="Pricing"
            title="Monthly interest, plainly stated."
            body="Alta Bank facilities accrue interest on outstanding balances once per month. No index-linked pricing, no introductory teasers, no surprise schedule changes."
          />
          <Pillar
            kicker="Underwriting"
            title="Reviewed by people who answer."
            body="Every application is read by an Alta credit officer who becomes your point of contact through structuring, signature, and the life of the facility."
          />
        </div>
      </Section>
    </PageShell>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 tabular font-mono text-[15px] text-foreground">
        {value}
      </dd>
    </div>
  );
}

function Pillar({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface-1/80 p-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        {kicker}
      </p>
      <h3 className="mt-3 font-serif text-[22px] leading-tight tracking-tight">
        {title}
      </h3>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </article>
  );
}