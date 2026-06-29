import { createFileRoute } from "@tanstack/react-router";
import { PrivateBankingQueueView } from "@/components/internal/queues";
import { fetchPrivateBankingQueueRows } from "@/lib/bank/alta-private.functions";

export const Route = createFileRoute("/internal/queues/private-banking")({
  loader: () => fetchPrivateBankingQueueRows(),
  head: () => ({ meta: [{ title: "Alta Private Queue — Alta Internal" }] }),
  component: PrivateBankingQueuePage,
});

function PrivateBankingQueuePage() {
  const rows = Route.useLoaderData();
  return <PrivateBankingQueueView rows={rows} />;
}
