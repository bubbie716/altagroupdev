import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { TransferFormPreview } from "@/components/bank/transfer-form-preview";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { florin, getTransferHistory } from "@/lib/bank/api";
import { fetchTransferContacts } from "@/lib/bank/bank.functions";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

export const Route = createFileRoute("/bank/transfers/interbank")({
  loader: async () => {
    if (isUserFinancialMockDataEnabled()) return null;
    const contacts = await fetchTransferContacts({ data: "interbank" });
    return { contacts };
  },
  head: () => ({
    meta: [{ title: "Interbank Transfers — Alta Bank" }],
  }),
  component: BankInterbankTransfers,
});

function BankInterbankTransfers() {
  const showMockData = isUserFinancialMockDataEnabled();
  const data = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Interbank"
      description="Outbound wires to external institutions via NCC-Net settlement."
    >
      <BankSubNav />

      {showMockData ? (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" />
          <Section>
            <TransferFormPreview disabled={!showMockData} />
          </Section>
          <Section title="Wire history" className="mt-10">
            <InterbankTransferHistoryMock />
          </Section>
        </>
      ) : !data ? (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" />
          <EmptyBankState
          title="Unable to load wire transfer page."
          description="Sign in and try again."
        />
        </>
      ) : (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" />
          <Section>
            <TransferFormPreview disabled contacts={data.contacts} />
          </Section>
        </>
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
