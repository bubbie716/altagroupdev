import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { TransferFormPreview } from "@/components/bank/transfer-form-preview";
import {
  BankTerminalFundingForm,
  TerminalFundingHistory,
} from "@/components/bank/bank-terminal-funding-form";
import { BusinessFutureNotice } from "@/components/bank/business-future-notice";
import { ScheduledTransferCenter } from "@/components/bank/scheduled-transfer-center";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { fetchTransferContacts } from "@/lib/bank/bank.functions";
import { fetchPaySourceAccounts } from "@/lib/bank/alta-pay.functions";
import {
  fetchTerminalFundingHistory,
  fetchTerminalFundingSources,
} from "@/lib/bank/ncc-terminal-funding.functions";
import {
  cancelUserScheduledTransferRecord,
  fetchUserScheduledTransfers,
} from "@/lib/bank/scheduled-transfer.functions";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

type BankInterbankSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/transfers/interbank")({
  validateSearch: (search: Record<string, unknown>): BankInterbankSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  loader: async () => {
    if (isUserFinancialMockDataEnabled()) return null;
    const [contacts, funding, history, scheduledTransfers, allSourceAccounts] = await Promise.all([
      fetchTransferContacts({ data: "interbank" }),
      fetchTerminalFundingSources(),
      fetchTerminalFundingHistory({ data: 20 }),
      fetchUserScheduledTransfers({ data: "interbank" }),
      fetchPaySourceAccounts(),
    ]);
    return {
      contacts,
      sourceAccounts: funding.sourceAccounts,
      terminalCash: funding.terminalCash,
      history,
      scheduledTransfers,
      allSourceAccounts,
    };
  },
  head: () => ({
    meta: [{ title: "Interbank Transfers — Alta Bank" }],
  }),
  component: BankInterbankTransfers,
});

function BankInterbankTransfers() {
  const showMockData = isUserFinancialMockDataEnabled();
  const data = Route.useLoaderData();
  const { accountId } = Route.useSearch();
  const router = useRouter();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Transfers"
        title="Interbank"
        description="Transfer instantly to your Alta Terminal account through NCC. External institution wires are coming soon."
      />
      {showMockData ? (
        <>
          <TransferPageHeader title="Transfer to Alta Terminal · NCC" accountId={accountId} />
          <Section>
            <EmptyBankState
              title="Sign in to transfer to Alta Terminal"
              description="Live Bank → Terminal transfers require an authenticated Alta Bank session."
            />
          </Section>
        </>
      ) : !data ? (
        <>
          <TransferPageHeader title="Transfer to Alta Terminal · NCC" accountId={accountId} />
          <EmptyBankState
            title="Unable to load interbank transfers."
            description="Sign in and try again."
          />
        </>
      ) : (
        <>
          <TransferPageHeader title="Transfer to Alta Terminal · NCC" accountId={accountId} />

          <Section title="Available now">
            <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
              Move FLR from a personal Alta Bank account to your own Alta Terminal trading-cash
              account. Settlement is immediate and individual through NCC — no batching or delayed
              clearing.
            </p>
            <BankTerminalFundingForm
              accounts={data.sourceAccounts}
              terminalAvailableBalance={data.terminalCash.availableBalance}
              defaultFromAccountId={accountId}
              onSuccess={() => void router.invalidate()}
            />
          </Section>

          <Section title="Recent Bank → Terminal transfers" className="mt-10">
            <TerminalFundingHistory rows={data.history} />
          </Section>

          <Section title="Coming soon" className="mt-10">
            <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
              Send to another NCC institution or an external wire beneficiary. You can save
              recipients on the Contacts page meanwhile.
            </p>
            <TransferFormPreview
              disabled
              contacts={data.contacts}
              defaultFromAccount={
                accountId
                  ? data.allSourceAccounts.find((account) => account.id === accountId)
                  : undefined
              }
            />
          </Section>

          <Section title="Scheduled & recurring wires" className="mt-10">
            <BusinessFutureNotice variant="interbank" />
            <InterbankScheduledTransfers data={data} defaultSourceAccountId={accountId} />
          </Section>
        </>
      )}
    </>
  );
}

function InterbankScheduledTransfers({
  data,
  defaultSourceAccountId,
}: {
  data: NonNullable<ReturnType<typeof Route.useLoaderData>>;
  defaultSourceAccountId?: string;
}) {
  const cancelTransfer = useServerFn(cancelUserScheduledTransferRecord);

  return (
    <ScheduledTransferCenter
      transferScope="interbank"
      defaultSourceAccountId={defaultSourceAccountId}
      sourceAccounts={data.allSourceAccounts.map((account) => ({
        id: account.id,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        ownerLabel: account.isCompanyAccount ? account.companyName : null,
      }))}
      payments={data.scheduledTransfers}
      contacts={data.contacts}
      canManage={false}
      onCreate={async () => {
        throw new Error(
          "Scheduled interbank wire transfers are not yet available. Instant transfers to your Alta Terminal account are available above.",
        );
      }}
      onCancel={async (paymentId) => {
        await cancelTransfer({ data: { paymentId, transferScope: "interbank" } });
      }}
    />
  );
}
