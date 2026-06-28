import { createFileRoute } from "@tanstack/react-router";
import { DepositsQueueView } from "@/components/internal/queues";
import { fetchInternalBankOps } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/internal/queues/deposits")({
  loader: async () => {
    const ops = await fetchInternalBankOps();
    return ops.pendingDeposits;
  },
  head: () => ({ meta: [{ title: "Deposits Queue — Alta Internal" }] }),
  component: DepositsQueuePage,
});

function DepositsQueuePage() {
  const pendingDeposits = Route.useLoaderData();
  return <DepositsQueueView pendingDeposits={pendingDeposits} />;
}
