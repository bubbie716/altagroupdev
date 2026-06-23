import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { TransferFormPreview } from "@/components/bank/transfer-form-preview";
import { florin, getTransferHistory } from "@/lib/bank/api";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

export const Route = createFileRoute("/bank/transfers/interbank")({
  head: () => ({
    meta: [{ title: "Interbank Transfers — Alta Bank" }],
  }),
  component: BankInterbankTransfers,
});

function BankInterbankTransfers() {
  const showMockData = isUserFinancialMockDataEnabled();

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Interbank"
      description="Outbound wires to external institutions via NCC-Net settlement."
    >
      <BankSubNav />

      <Link
        to="/bank/transfers"
        className="mb-8 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← All transfer types
      </Link>

      <Section title="Wire transfer · NCC-Net">
        <TransferFormPreview disabled={!showMockData} />
      </Section>

      {showMockData && (
        <Section title="Wire history" className="mt-10">
          <InterbankTransferHistoryMock />
        </Section>
      )}
    </PageShell>
  );
}

function InterbankTransferHistoryMock() {
  const transferHistory = getTransferHistory().filter((transfer) => transfer.type === "Wire");

  if (transferHistory.length === 0) {
    return (
      <Card className="!p-8 text-center">
        <p className="text-[14px] text-muted-foreground">No wire transfers yet.</p>
      </Card>
    );
  }

  return (
    <Card className="!p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">From</th>
            <th className="px-5 py-3">To</th>
            <th className="px-5 py-3">Settlement</th>
            <th className="px-5 py-3 text-right">Amount</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {transferHistory.map((transfer) => (
            <tr
              key={transfer.id}
              className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
            >
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{transfer.date}</td>
              <td className="px-5 py-3 text-muted-foreground">{transfer.from}</td>
              <td className="px-5 py-3">{transfer.to}</td>
              <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                {transfer.settlement ?? "—"}
              </td>
              <td className="tabular px-5 py-3 text-right">{florin(transfer.amount)}</td>
              <td className="px-5 py-3 font-mono text-[11px]">{transfer.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
