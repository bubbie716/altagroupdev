import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AdminQueueTable } from "@/components/bank/admin-queue-table";
import { getAdminPrivateQueue } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/admin/private")({
  head: () => ({
    meta: [{ title: "Alta Bank Admin — Private Invites" }],
  }),
  component: AdminPrivate,
});

function AdminPrivate() {
  const adminPrivateQueue = getAdminPrivateQueue();

  return (
    <PageShell
      eyebrow="Alta Bank · Relationship Manager"
      title="Private Invitations"
      description="Review Alta Private invitation requests — simulated admin preview."
    >
      <BankSubNav />

      <Section title="Invitation Queue">
        <AdminQueueTable
          title="Pending Invitations"
          rows={adminPrivateQueue.map((p) => ({
            id: p.id,
            primary: p.name,
            secondary: `Submitted ${p.submitted}`,
            amount: p.balance,
            status: p.status,
          }))}
          showActions
        />
      </Section>
    </PageShell>
  );
}
