import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaPayForm } from "@/components/bank/alta-pay-form";
import { AltaPayHistoryTable } from "@/components/bank/alta-pay-received-panel";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import {
  fetchPaySourceAccounts,
  fetchUserAltaPayHistory,
} from "@/lib/bank/alta-pay.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/pay")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const [accounts, history] = await Promise.all([
      fetchPaySourceAccounts(),
      fetchUserAltaPayHistory({ data: 25 }),
    ]);
    return { accounts, history };
  },
  head: () => ({
    meta: [{ title: "Alta Pay — Alta Bank" }],
  }),
  component: AltaPayPage,
});

function AltaPayPage() {
  const { accounts, history } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Pay"
      title="Pay a Business"
      description="Send Florins to verified Newport companies instantly — from a personal account or your company's Business Operating Account."
    >
      <BankSubNav />

      {accounts.length === 0 ? (
        <EmptyBankState
          title="No eligible payment accounts"
          description="Open a personal Alta Bank account, or ensure you have treasury access to an active Business Operating Account for a verified company."
        />
      ) : (
        <>
          <AltaPayForm accounts={accounts} />

          <Section title="Payment history" className="mt-12">
            <Card className="!p-6">
              <AltaPayHistoryTable payments={history} />
            </Card>
          </Section>
        </>
      )}
    </PageShell>
  );
}
