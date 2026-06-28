import { createFileRoute } from "@tanstack/react-router";
import { WithdrawalsQueueView } from "@/components/internal/queues";
import { fetchPendingWithdrawalsQueue } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/internal/queues/withdrawals")({
  loader: () => fetchPendingWithdrawalsQueue(),
  head: () => ({ meta: [{ title: "Withdrawals Queue — Alta Internal" }] }),
  component: WithdrawalsQueuePage,
});

function WithdrawalsQueuePage() {
  const pendingWithdrawals = Route.useLoaderData();
  return <WithdrawalsQueueView pendingWithdrawals={pendingWithdrawals} />;
}
