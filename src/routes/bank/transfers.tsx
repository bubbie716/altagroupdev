import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { TransferFormPreview } from "@/components/bank/transfer-form-preview";
import { florin, getTransferHistory } from "@/lib/bank/api";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/transfers")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Alta Bank Transfers — Alta Group" }],
  }),
  component: BankTransfers,
});

function BankTransfers() {
  const transferHistory = getTransferHistory();

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Transfers & Wires"
      description="Move funds across Alta accounts or initiate outbound wires via NCC-Net — preview interface only."
    >
      <BankSubNav />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Internal Transfer">
          <Card>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Move funds between Alta Checking, Savings, Reserve, and Business accounts — instant
              settlement within Alta Bank.
            </p>
            <div className="mt-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] text-muted-foreground">
              Transfer execution is simulated in this preview.
            </div>
          </Card>
        </Section>
        <Section title="Scheduled Transfers">
          <Card>
            <ul className="space-y-3 text-sm">
              {transferHistory
                .filter((t) => t.status === "Scheduled")
                .map((t) => (
                  <li key={t.id} className="flex justify-between border-b border-border/50 pb-3 last:border-0">
                    <span>{t.to}</span>
                    <span className="tabular font-mono">{florin(t.amount)}</span>
                  </li>
                ))}
            </ul>
          </Card>
        </Section>
      </div>

      <Section title="Wire Transfer · NCC-Net" className="mt-10">
        <TransferFormPreview />
      </Section>

      <Section title="Transfer History" className="mt-10">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">From</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Settlement</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {transferHistory.map((t) => (
                <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{t.date}</td>
                  <td className="px-5 py-3">{t.type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.from}</td>
                  <td className="px-5 py-3">{t.to}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">{t.settlement ?? "—"}</td>
                  <td className="tabular px-5 py-3 text-right">{florin(t.amount)}</td>
                  <td className="px-5 py-3 font-mono text-[11px]">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </PageShell>
  );
}
