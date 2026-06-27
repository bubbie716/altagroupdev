import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchInternalAltaCardApplicationThread } from "@/lib/bank/alta-card-application.functions";
import {
  mapAltaCardThreadContextToLoan,
  mapAltaCardThreadMessagesToLoan,
} from "@/lib/bank/alta-card-thread-adapter";

export const Route = createFileRoute("/internal/alta-card/applications/$applicationId/thread")({
  loader: async ({ params }) => {
    try {
      return await fetchInternalAltaCardApplicationThread({ data: params.applicationId });
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Alta Internal" }] }),
  notFoundComponent: () => (
    <InternalPageShell title="Secure deal room not found">
      <EmptyState
        tag="404"
        title="This secure deal room is not available"
        action={
          <Link to="/internal/alta-card/applications" className="text-gold hover:underline">
            Back to applications
          </Link>
        }
      />
    </InternalPageShell>
  ),
  component: InternalAltaCardApplicationThreadPage,
});

function InternalAltaCardApplicationThreadPage() {
  const { context, messages } = Route.useLoaderData();
  const { applicationId } = Route.useParams();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={mapAltaCardThreadContextToLoan(context)}
        messages={mapAltaCardThreadMessagesToLoan(messages)}
        variant="internal"
        product="alta-card"
        backTo="/internal/alta-card/applications/$applicationId"
        backParams={{ applicationId }}
        backLabel="← Application review"
      />
    </div>
  );
}
