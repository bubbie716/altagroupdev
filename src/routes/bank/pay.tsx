import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import {
  AltaPayForm,
  altaCardPayFundingKey,
  bankAccountPayFundingKey,
  employeeCardPayFundingKey,
} from "@/components/bank/alta-pay-form";
import { AltaPayHistoryTable } from "@/components/bank/alta-pay-received-panel";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { fetchUserBankSettings } from "@/lib/bank/bank-settings.functions";
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
    const [fundingSources, history, bankSettings] = await Promise.all([
      fetchPayFundingSources(),
      fetchUserAltaPayHistory({ data: 25 }),
      fetchUserBankSettings(),
    ]);
    return { fundingSources, history, bankSettings };
  },
  head: () => ({
    meta: [{ title: "Alta Pay — Alta Bank" }],
  }),
  component: AltaPayPage,
});

function AltaPayPage() {
  const { fundingSources, history, bankSettings } = Route.useLoaderData();
  const { employeeCardId, cardId } = Route.useSearch();
  const defaultFundingKey = employeeCardId
    ? employeeCardPayFundingKey(employeeCardId)
    : cardId
      ? altaCardPayFundingKey(cardId)
      : bankSettings.defaultAltaPayFundingAccountId
        ? bankAccountPayFundingKey(bankSettings.defaultAltaPayFundingAccountId)
        : undefined;

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Pay"
      title="Alta Pay"
      description="Send money to another Alta customer or Alta company."
     />
{fundingSources.length === 0 ? (
        <EmptyBankState
          title="No eligible payment sources"
          description="Open a personal Alta Bank account or activate an Alta Card to send money through Alta Pay."
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
