import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { BankInternalTransferForm } from "@/components/bank/bank-internal-transfer-form";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { florin } from "@/lib/bank/api";
import { fetchActiveBankAccounts, fetchUserInternalTransfers } from "@/lib/bank/bank.functions";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import type { UserBankTransfer } from "@/lib/bank/backend-types";

export const Route = createFileRoute("/bank/transfers/intrabank")({
  loader: async () => {
    if (isUserFinancialMockDataEnabled()) return null;
    const [accounts, transfers] = await Promise.all([
      fetchActiveBankAccounts(),
      fetchUserInternalTransfers({ data: 20 }),
    ]);
    return { accounts, transfers };
  },
  head: () => ({
    meta: [{ title: "Intrabank Transfers — Alta Bank" }],
  }),
  component: BankIntrabankTransfers,
});

function BankIntrabankTransfers() {
  const showMockData = isUserFinancialMockDataEnabled();
  const data = Route.useLoaderData();
  const router = useRouter();

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Intrabank"
      description="Move funds instantly within Alta Bank — between your accounts or to another player."
    >
      <BankSubNav />

      <Link
        to="/bank/transfers"
        className="mb-8 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline"
      >
        ← All transfer types
      </Link>

      {showMockData ? (
        <Card className="!p-6">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Intrabank transfers between Alta Checking, Savings, Reserve, and Business accounts are
            simulated in this preview.
          </p>
        </Card>
      ) : !data || data.accounts.length === 0 ? (
        <EmptyBankState
          title="No active Alta Bank accounts yet."
          description="Open Alta Bank accounts to transfer between your positions or send to another player."
        />
      ) : (
        <>
          <Section title="Transfer funds">
            <Card className="mx-auto max-w-2xl !p-6">
              <BankInternalTransferForm
                accounts={data.accounts}
                onSuccess={() => void router.invalidate()}
              />
            </Card>
          </Section>

          <Section title="Transfer history" className="mt-10">
            <InternalTransferHistory transfers={data.transfers} />
          </Section>
        </>
      )}
    </PageShell>
  );
}

function InternalTransferHistory({ transfers }: { transfers: UserBankTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <Card className="!p-8 text-center">
        <p className="text-[14px] text-muted-foreground">No intrabank transfers yet.</p>
      </Card>
    );
  }

  return (
    <Card className="!p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Direction</th>
            <th className="px-5 py-3">From</th>
            <th className="px-5 py-3">To</th>
            <th className="px-5 py-3">Reference</th>
            <th className="px-5 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr
              key={`${transfer.id}-${transfer.direction}`}
              className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
            >
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                {transfer.createdAt.slice(0, 10)}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] capitalize">{transfer.direction}</td>
              <td className="px-5 py-3">
                <div>{transfer.fromAccountName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {transfer.fromAccountNumber}
                </div>
              </td>
              <td className="px-5 py-3">
                <div>{transfer.toAccountName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {transfer.toAccountNumber}
                </div>
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                {transfer.referenceCode}
              </td>
              <td className="tabular px-5 py-3 text-right font-medium">{florin(transfer.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
