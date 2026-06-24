import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { TransferFormPreview } from "@/components/bank/transfer-form-preview";
import { BusinessFutureNotice } from "@/components/bank/business-future-notice";
import { ScheduledTransferCenter } from "@/components/bank/scheduled-transfer-center";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { fetchTransferContacts } from "@/lib/bank/bank.functions";
import { fetchPaySourceAccounts } from "@/lib/bank/alta-pay.functions";
import {
  cancelUserScheduledTransferRecord,
  createUserScheduledTransferRecord,
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
    const [contacts, sourceAccounts, scheduledTransfers] = await Promise.all([
      fetchTransferContacts({ data: "interbank" }),
      fetchPaySourceAccounts(),
      fetchUserScheduledTransfers({ data: "interbank" }),
    ]);
    return { contacts, sourceAccounts, scheduledTransfers };
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

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Interbank"
      description="Outbound wires to external institutions via NCC-Net settlement."
    >
      <BankSubNav />

      {showMockData ? (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" accountId={accountId} />
          <Section>
            <TransferFormPreview disabled={!showMockData} />
          </Section>
        </>
      ) : !data ? (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" accountId={accountId} />
          <EmptyBankState
          title="Unable to load wire transfer page."
          description="Sign in and try again."
        />
        </>
      ) : data.sourceAccounts.length === 0 ? (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" accountId={accountId} />
          <EmptyBankState
            title="No active Alta Bank accounts yet."
            description="Open a personal or business operating account to schedule outbound wires."
          />
        </>
      ) : (
        <>
          <TransferPageHeader title="Wire transfer · NCC-Net" accountId={accountId} />
          <Section>
            <TransferFormPreview
              disabled
              contacts={data.contacts}
              defaultFromAccount={
                accountId
                  ? data.sourceAccounts.find((account: any) => account.id === accountId)
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
    </PageShell>
  );
}

function InterbankScheduledTransfers({
  data,
  defaultSourceAccountId,
}: {
  data: NonNullable<ReturnType<typeof Route.useLoaderData>>;
  defaultSourceAccountId?: string;
}) {
  const createTransfer = useServerFn(createUserScheduledTransferRecord);
  const cancelTransfer = useServerFn(cancelUserScheduledTransferRecord);

  return (
    <ScheduledTransferCenter
      transferScope="interbank"
      defaultSourceAccountId={defaultSourceAccountId}
      sourceAccounts={data.sourceAccounts.map((account: any) => ({
        id: account.id,
        accountName: account.accountName,
        accountNumber: account.accountNumber,
        ownerLabel: account.isCompanyAccount ? account.companyName : null,
      }))}
      payments={data.scheduledTransfers}
      contacts={data.contacts}
      canManage
      onCreate={async (input) => {
        await createTransfer({ data: { ...input, transferScope: "interbank" } });
      }}
      onCancel={async (paymentId) => {
        await cancelTransfer({ data: { paymentId, transferScope: "interbank" } });
      }}
    />
  );
}
