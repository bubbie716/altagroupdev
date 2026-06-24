import { createFileRoute, Link } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalScheduledTransfersPanel } from "@/components/bank/internal-scheduled-transfers-panel";
import { Section } from "@/components/page-shell";
import { fetchInternalScheduledTransfers } from "@/lib/bank/scheduled-transfer-admin.functions";

export const Route = createFileRoute("/internal/bank/scheduled")({
  loader: async () => {
    const transfers = await fetchInternalScheduledTransfers();
    return { transfers };
  },
  head: () => ({ meta: [{ title: "Scheduled Transfers — Alta Internal" }] }),
  component: InternalScheduledTransfersPage,
});

function InternalScheduledTransfersPage() {
  const { transfers } = Route.useLoaderData();
  const active = transfers.filter((t: any) =>
    ["approved", "paused", "pending_review"].includes(t.status),
  );

  return (
    <InternalPageShell
      title="Scheduled Transfers"
      description="Intrabank scheduled and recurring transfers. Automatic execution applies to approved Alta-to-Alta transfers only."
    >
      <p className="text-[13px] text-muted-foreground">
        <Link to="/internal/bank" className="hover:underline">
          ← Bank Operations
        </Link>
      </p>

      <Section title="Run executor" className="mt-8">
        <InternalScheduledTransfersPanel transfers={[]} showRunButton />
      </Section>

      <Section title={`Active scheduled transfers (${active.length})`} className="mt-10">
        <InternalScheduledTransfersPanel transfers={active} showRunButton={false} />
      </Section>

      <Section title={`All intrabank scheduled transfers (${transfers.length})`} className="mt-10">
        <InternalScheduledTransfersPanel transfers={transfers} showRunButton={false} />
      </Section>
    </InternalPageShell>
  );
}
