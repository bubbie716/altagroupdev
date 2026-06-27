import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchInternalLoanApplicationThread } from "@/lib/bank/loan-application-thread.functions";

export const Route = createFileRoute("/internal/lending/applications/$applicationId/thread")({
  loader: async ({ params }) => {
    try {
      return await fetchInternalLoanApplicationThread({ data: params.applicationId });
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Alta Internal" }] }),
  notFoundComponent: () => (
    <InternalPageShell title="Secure Deal Room not found">
      <EmptyState
        tag="404"
        title="This Secure Deal Room is not available"
        action={
          <Link to="/internal/lending" className="text-gold hover:underline">
            Back to lending
          </Link>
        }
      />
    </InternalPageShell>
  ),
  component: InternalApplicationThreadPage,
});

function InternalApplicationThreadPage() {
  const { context, messages } = Route.useLoaderData();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={context}
        messages={messages}
        variant="internal"
        backTo="/internal/lending"
        backLabel="← Lending queue"
      />
    </div>
  );
}
