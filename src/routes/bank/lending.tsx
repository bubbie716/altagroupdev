import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { getLendingProducts } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/lending")({
  head: () => ({
    meta: [{ title: "Alta Bank Lending — Alta Group" }],
  }),
  component: BankLending,
});

function BankLending() {
  const lendingProducts = getLendingProducts();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Lending"
      description="Credit facilities for Newport citizens, founders, and institutions — subject to standard underwriting review."
    >
      <BankSubNav />

      <div className="grid gap-4 md:grid-cols-2">
        {lendingProducts.map((p) => (
          <Card key={p.name}>
            <div className="flex items-start justify-between gap-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{p.name}</div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {p.status}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Limit</div>
                <div className="tabular mt-1 font-medium">{p.limit}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Rate</div>
                <div className="tabular mt-1 font-medium">{p.rate}</div>
              </div>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{p.summary}</p>
          </Card>
        ))}
      </div>

      <Section title="Standby Liquidity" className="mt-12">
        <Card>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Alta Bank offers personal and business credit lines, with standby liquidity facilities
            available through Alta Private. Terms vary by product. All lending shown is simulated.
          </p>
        </Card>
      </Section>
    </PageShell>
  );
}
