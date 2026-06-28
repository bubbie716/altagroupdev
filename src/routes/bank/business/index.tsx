import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { RouteButton } from "@/components/bank/route-button";
import { EditorialCtaStrip } from "@/components/bank/editorial-cta-strip";

export const Route = createFileRoute("/bank/business/")({
  head: () => ({ meta: [{ title: "Business Banking — Alta Bank" }] }),
  component: BusinessBankingMarketingPage,
});

function BusinessBankingMarketingPage() {
  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Business"
      title="Business Banking"
      description="Treasury, payroll, and Alta Pay for verified Newport companies — operated from your Business Operating Account."
     />
<EditorialCtaStrip
        eyebrow="Business Operating Account"
        title="Account-scoped treasury."
        description="Payroll, scheduled transfers, Alta Pay received, authorized representatives, and statements all live on your company's Business Operating Account — never a separate global tab."
        actions={
          <>
            <RouteButton
              to="/bank/open"
              className="rounded-md bg-foreground px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background hover:bg-foreground/90"
            >
              Open Operating Account
            </RouteButton>
            <RouteButton
              to="/bank"
              className="rounded-md border border-border bg-surface-2/60 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:bg-surface-2"
            >
              Go to dashboard
            </RouteButton>
          </>
        }
        stats={[
          { label: "Verification", value: "Required" },
          { label: "Access model", value: "Role-based" },
          { label: "Separation", value: "Per company" },
          { label: "Review", value: "Manual" },
        ]}
      />

      <Section title="What's included" className="mt-12">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Payments", "Alta Pay received and outbound treasury queues"],
            ["Payroll", "Employee registry and payroll batch submission"],
            ["Scheduled", "Future-dated and recurring treasury transfers"],
            ["Representatives", "Role-based treasury permissions"],
            ["Statements", "Monthly operating account statements"],
            ["Activity", "Approved transaction history"],
          ].map(([title, desc], i) => (
            <div key={title} className="bg-surface-1 p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-3 font-serif text-[18px] leading-tight tracking-tight">{title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
