import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { LoanApplicationThreadView } from "@/components/bank/loan-thread/loan-application-thread-view";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SECURE_DEAL_ROOM_NOT_AVAILABLE_TITLE,
  SECURE_DEAL_ROOM_NOT_FOUND_TITLE,
} from "@/lib/bank/bank-shared-copy";
import { fetchAltaCardApplicationThread } from "@/lib/bank/alta-card-application.functions";
import {
  mapAltaCardThreadContextToLoan,
  mapAltaCardThreadMessagesToLoan,
} from "@/lib/bank/alta-card-thread-adapter";

export const Route = createFileRoute("/bank/alta-card/applications/$applicationId/thread")({
  loader: async ({ params }) => {
    try {
      return await fetchAltaCardApplicationThread({ data: params.applicationId });
    } catch (error) {
      if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FORBIDDEN")) {
        throw notFound();
      }
      throw error;
    }
  },
  head: () => ({ meta: [{ title: "Secure Deal Room — Alta Bank" }] }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank" title={SECURE_DEAL_ROOM_NOT_FOUND_TITLE}>
      <EmptyState
        tag="404"
        title={SECURE_DEAL_ROOM_NOT_AVAILABLE_TITLE}
        action={
          <Link to="/bank/alta-card" className="text-gold hover:underline">
            Back to Alta Card
          </Link>
        }
      />
    </PageShell>
  ),
  component: BankAltaCardApplicationThreadPage,
});

function BankAltaCardApplicationThreadPage() {
  const { context, messages } = Route.useLoaderData();
  const { applicationId } = Route.useParams();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <LoanApplicationThreadView
        className="min-h-0 flex-1"
        context={mapAltaCardThreadContextToLoan(context)}
        messages={mapAltaCardThreadMessagesToLoan(messages)}
        variant="user"
        product="alta-card"
        backTo="/bank/alta-card/applications/$applicationId"
        backParams={{ applicationId }}
        backLabel="← Application"
      />
    </div>
  );
}
