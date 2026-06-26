import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
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
  head: () => ({ meta: [{ title: "Application Thread — Alta Bank" }] }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank" title="Thread not found">
      <EmptyState
        tag="404"
        title="This application thread is not available"
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
      <div className="shrink-0 border-b border-border/60 bg-surface-1">
        <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          <BankSubNav />
          <LendingSubNav />
        </div>
      </div>
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
