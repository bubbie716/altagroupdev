import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchLoanApplicationThread } from "@/lib/bank/loan-application-thread.functions";

export const Route = createFileRoute("/bank/lending/applications/$applicationId/thread")({
  loader: async ({ params }) => {
    try {
      return await fetchLoanApplicationThread({ data: params.applicationId });
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Alta Bank" }] }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank" title="Secure Deal Room not found">
      <EmptyState
        tag="404"
        title="This Secure Deal Room is not available"
        action={
          <Link to="/bank/lending/applications" className="text-gold hover:underline">
            Back to applications
          </Link>
        }
      />
    </PageShell>
  ),
  component: BankApplicationThreadPage,
});

function BankApplicationThreadPage() {
  const { context, messages } = Route.useLoaderData();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={context}
        messages={messages}
        variant="user"
        backTo="/bank/lending/applications"
        backLabel="← My applications"
      />
    </div>
  );
}
