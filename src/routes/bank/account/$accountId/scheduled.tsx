import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BusinessAccountPaymentsCenter } from "@/components/bank/business-account-payments-center";
import { ScheduledTransferCenter } from "@/components/bank/scheduled-transfer-center";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchScheduledPayments } from "@/lib/bank/business-banking.functions";
import { fetchTransferContacts, fetchUserBankAccountDetail } from "@/lib/bank/bank.functions";
import {
  cancelUserScheduledTransferRecord,
  createUserScheduledTransferRecord,
  fetchUserScheduledTransfers,
} from "@/lib/bank/scheduled-transfer.functions";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/scheduled")({
  loader: async ({ params }) => {
    const account = await fetchUserBankAccountDetail({ data: params.accountId });
    const isBusinessOperating = account.accountType === "business_operating";

    if (isBusinessOperating) {
      const ctx = await fetchBusinessAccountContextForModule({
        data: { accountId: params.accountId, module: "scheduled" },
      });
      const [payments, contacts] = await Promise.all([
        fetchScheduledPayments({ data: ctx.companyId }),
        fetchTransferContacts({ data: "intrabank" }),
      ]);
      return { isBusinessOperating: true as const, payments, contacts };
    }

    const [payments, contacts] = await Promise.all([
      fetchUserScheduledTransfers({ data: "intrabank" }),
      fetchTransferContacts({ data: "intrabank" }),
    ]);

    return { isBusinessOperating: false as const, payments, contacts };
  },
  head: () => ({ meta: [{ title: "Scheduled Transfers — Account" }] }),
  component: AccountScheduledPage,
});

function AccountScheduledPage() {
  const { account, businessContext } = AccountRoute.useLoaderData();
  const { isBusinessOperating, payments, contacts } = Route.useLoaderData();
  const router = useRouter();
  const createTransfer = useServerFn(createUserScheduledTransferRecord);
  const cancelTransfer = useServerFn(cancelUserScheduledTransferRecord);

  if (isBusinessOperating && businessContext) {
    return (
      <BusinessAccountPaymentsCenter
        company={businessContext.treasury}
        payments={payments}
        contacts={contacts}
      />
    );
  }

  const accountPayments = payments.filter((payment) => payment.bankAccountId === account.id);

  return (
    <ScheduledTransferCenter
      transferScope="intrabank"
      sourceAccounts={[
        {
          id: account.id,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          ownerLabel: account.ownerLabel,
        },
      ]}
      payments={accountPayments}
      contacts={contacts}
      canManage
      onCreate={async (input) => {
        await createTransfer({ data: { ...input, transferScope: "intrabank" } });
        void router.invalidate();
      }}
      onCancel={async (paymentId) => {
        await cancelTransfer({ data: { paymentId, transferScope: "intrabank" } });
        void router.invalidate();
      }}
    />
  );
}
