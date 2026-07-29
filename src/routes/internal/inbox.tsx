import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/internal/inbox/inbox-page";
import { fetchInternalInbox } from "@/lib/internal/inbox.functions";
import { parseInboxSearch } from "@/lib/internal/inbox-types";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/inbox")({
  validateSearch: (search: Record<string, unknown>) => parseInboxSearch(search),
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) => fetchInternalInbox({ data: { search: deps.search as Record<string, unknown> } }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Inbox", (match.search as { site?: string }).site) }] }),
  component: InboxRoute,
});

function InboxRoute() {
  const payload = Route.useLoaderData();
  return <InboxPage payload={payload} />;
}
