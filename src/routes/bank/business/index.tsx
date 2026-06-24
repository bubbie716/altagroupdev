import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";

export const Route = createFileRoute("/bank/business/")({
  head: () => ({ meta: [{ title: "Business Banking — Alta Bank" }] }),
  component: BusinessBankingMarketingPage,
});

function BusinessBankingMarketingPage() {
  return (
    <PageShell
      eyebrow="Alta Bank · Business"
      title="Business Banking"
      description="Treasury, payroll, and Alta Pay for verified Newport companies — operated from your Business Operating Account."
    >
      <BankSubNav />

      <div className="grid gap-8 lg:grid-cols-2">
        <Card className="!p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Business Operating Account
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Account-scoped treasury</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            Payroll, scheduled transfers, Alta Pay received, authorized representatives, and
            statements live on your company&apos;s Business Operating Account — not a separate global
            business tab.
          </p>
          <ul className="mt-6 space-y-2 text-[13px] text-muted-foreground">
            <li>· Verified company required</li>
            <li>· Role-based access via company membership</li>
            <li>· Separate from personal Alta Bank accounts</li>
          </ul>
        </Card>

        <Card className="!p-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Get started
          </div>
          <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
            Register and verify your company, then open a Business Operating Account. Once active,
            manage treasury from your{" "}
            <Link to="/bank" className="text-gold hover:underline">
              bank dashboard
            </Link>
            .
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/bank/open"
              className="inline-flex rounded-md bg-foreground px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90"
            >
              Open Business Operating Account
            </Link>
            <Link
              to="/bank"
              className="inline-flex rounded-md border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-surface-2"
            >
              Go to dashboard
            </Link>
          </div>
        </Card>
      </div>

      <Section title="What's included" className="mt-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Payments", "Alta Pay received and outbound treasury queues"],
            ["Payroll", "Employee registry and payroll batch submission"],
            ["Scheduled", "Future-dated and recurring treasury transfers"],
            ["Representatives", "Role-based treasury permissions"],
            ["Statements", "Monthly operating account statements"],
            ["Activity", "Approved transaction history"],
          ].map(([title, desc]) => (
            <Card key={title} className="!p-5">
              <div className="font-medium">{title}</div>
              <p className="mt-2 text-[13px] text-muted-foreground">{desc}</p>
            </Card>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
