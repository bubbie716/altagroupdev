import { createFileRoute } from "@tanstack/react-router";
import { PrivateBankingQueueView } from "@/components/internal/queues";
import { fetchInternalUsers } from "@/lib/internal/user-management.functions";

export const Route = createFileRoute("/internal/queues/private-banking")({
  loader: () => fetchInternalUsers({ data: {} }),
  head: () => ({ meta: [{ title: "Private Banking Queue — Alta Internal" }] }),
  component: PrivateBankingQueuePage,
});

function PrivateBankingQueuePage() {
  const users = Route.useLoaderData();
  return <PrivateBankingQueueView users={users} />;
}
