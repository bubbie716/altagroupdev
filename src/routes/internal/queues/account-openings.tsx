import { createFileRoute } from "@tanstack/react-router";
import { AccountOpeningsQueueView } from "@/components/internal/queues";
import { fetchInternalBankOps } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/internal/queues/account-openings")({
  loader: async () => {
    const ops = await fetchInternalBankOps();
    return ops.pendingAccounts;
  },
  head: () => ({ meta: [{ title: "Account Openings Queue — Alta Internal" }] }),
  component: AccountOpeningsQueuePage,
});

function AccountOpeningsQueuePage() {
  const pendingAccounts = Route.useLoaderData();
  return <AccountOpeningsQueueView pendingAccounts={pendingAccounts} />;
}
