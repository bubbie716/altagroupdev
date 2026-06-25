import { createFileRoute } from "@tanstack/react-router";
import { InternalDepositsQueue } from "@/components/internal/internal-deposits-queue";
import { fetchInternalBankOps } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/internal/bank/deposits")({
  loader: async () => {
    const ops = await fetchInternalBankOps();
    return ops.pendingDeposits;
  },
  head: () => ({ meta: [{ title: "Deposit Review — Alta Internal" }] }),
  component: InternalDeposits,
});

function InternalDeposits() {
  const pendingDeposits = Route.useLoaderData();
  return <InternalDepositsQueue pendingDeposits={pendingDeposits} />;
}
