import { createFileRoute } from "@tanstack/react-router";
import { ExceptionsQueueView, type ExceptionQueueItem } from "@/components/internal/queues";
import { fetchExceptionCenter } from "@/lib/internal/ops-platform.functions";

export const Route = createFileRoute("/internal/queues/exceptions")({
  loader: async () => {
    const items = await fetchExceptionCenter();
    return items.map(
      (item) =>
        ({
          id: item.id,
          category: item.category,
          severity: item.severity,
          title: item.title,
          detail: item.detail,
          href: item.href,
          amount: item.amount,
          createdAt: item.createdAt,
        }) satisfies ExceptionQueueItem,
    );
  },
  head: () => ({ meta: [{ title: "Exceptions Queue — Alta Internal" }] }),
  component: ExceptionsQueuePage,
});

function ExceptionsQueuePage() {
  const items = Route.useLoaderData();
  return <ExceptionsQueueView items={items} />;
}
