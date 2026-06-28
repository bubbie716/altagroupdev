import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaPayForm, altaCardPayFundingKey, employeeCardPayFundingKey } from "@/components/bank/alta-pay-form";
import { AltaPayHistoryTable } from "@/components/bank/alta-pay-received-panel";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import {
  fetchPayFundingSources,
  fetchUserAltaPayHistory,
} from "@/lib/bank/alta-pay.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

type AltaPaySearch = {
  employeeCardId?: string;
  cardId?: string;
};

export const Route = createFileRoute("/bank/pay")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): AltaPaySearch => {
    const result: AltaPaySearch = {};
    const employeeCardId = search.employeeCardId;
    const cardId = search.cardId;
    if (typeof employeeCardId === "string" && employeeCardId.trim()) {
      result.employeeCardId = employeeCardId.trim();
    }
    if (typeof cardId === "string" && cardId.trim()) {
      result.cardId = cardId.trim();
    }
    return result;
  },
  loader: async () => {
    const [fundingSources, history] = await Promise.all([
      fetchPayFundingSources(),
      fetchUserAltaPayHistory({ data: 25 }),
    ]);
    return { fundingSources, history };
  },
  head: () => ({
    meta: [{ title: "Alta Pay — Alta Bank" }],
  }),
  component: AltaPayPage,
});

function AltaPayPage() {
  const { fundingSources, history } = Route.useLoaderData();
  const { employeeCardId, cardId } = Route.useSearch();
  const defaultFundingKey = employeeCardId
    ? employeeCardPayFundingKey(employeeCardId)
    : cardId
      ? altaCardPayFundingKey(cardId)
      : undefined;

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Pay"
      title="Pay a Business"
      description="Send Florins to verified Newport companies instantly — from a bank account or your Alta Card."
     />
{fundingSources.length === 0 ? (
        <EmptyBankState
          title="No eligible payment sources"
          description="Open a personal Alta Bank account or activate an Alta Card to pay businesses through Alta Pay."
        />
      ) : (
        <>
          <AltaPayForm fundingSources={fundingSources} defaultFundingKey={defaultFundingKey} />

          <Section title="Payment history" className="mt-12">
            <Card className="!p-6">
              <AltaPayHistoryTable payments={history} />
            </Card>
          </Section>
        </>
      )}
    </>
  );
}
