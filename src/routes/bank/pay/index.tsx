import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import {
  altaCardPayFundingKey,
  bankAccountPayFundingKey,
  employeeCardPayFundingKey,
} from "@/components/bank/alta-pay-form";
import { AltaPayEnginePanel, type AltaPayEngineTab } from "@/components/bank/alta-pay-engine-panel";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { fetchUserBankSettings } from "@/lib/bank/bank-settings.functions";
import { fetchPayFundingSources, fetchUserAltaPayHistory } from "@/lib/bank/alta-pay.functions";
import {
  fetchAltaPaySchedules,
  fetchMerchantAutopayApprovals,
} from "@/lib/bank/payments-engine.functions";

type AltaPaySearch = {
  employeeCardId?: string;
  cardId?: string;
  tab?: AltaPayEngineTab;
};

function parseAltaPayTab(value: unknown): AltaPayEngineTab | undefined {
  if (value === "scheduled" || value === "recurring" || value === "autopay") return value;
  return undefined;
}

export const Route = createFileRoute("/bank/pay/")({
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
    const tab = parseAltaPayTab(search.tab);
    if (tab) result.tab = tab;
    return result;
  },
  loader: async () => {
    const fundingSources = await fetchPayFundingSources();
    const history = await fetchUserAltaPayHistory({ data: 25 });
    const bankSettings = await fetchUserBankSettings();
    const schedules = await fetchAltaPaySchedules();
    const autopayApprovals = await fetchMerchantAutopayApprovals();
    return { fundingSources, history, bankSettings, schedules, autopayApprovals };
  },
  head: () => ({
    meta: [{ title: "Alta Pay — Alta Bank" }],
  }),
  component: AltaPayPage,
});

function AltaPayPage() {
  const { fundingSources, history, bankSettings, schedules, autopayApprovals } = Route.useLoaderData();
  const { employeeCardId, cardId, tab = "now" } = Route.useSearch();
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
        description="Send money now, schedule future payments, set up recurring payments, and manage merchant AutoPay."
      />
      {fundingSources.length === 0 ? (
        <EmptyBankState
          title="No eligible payment sources"
          description="Open a personal Alta Bank account or activate an Alta Card to send money through Alta Pay."
        />
      ) : (
        <Section title="Payments">
          <AltaPayEnginePanel
            tab={tab}
            fundingSources={fundingSources}
            defaultFundingKey={defaultFundingKey}
            history={history}
            schedules={schedules}
            autopayApprovals={autopayApprovals}
          />
        </Section>
      )}
    </>
  );
}
