import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AdminQueueTable } from "@/components/bank/admin-queue-table";
import { getAdminLoanQueue } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/admin/loans")({
  head: () => ({
    meta: [{ title: "Alta Bank Admin — Loan Review" }],
  }),
  component: AdminLoans,
});

function AdminLoans() {
  const adminLoanQueue = getAdminLoanQueue();

  return (
    <PageShell
      eyebrow="Alta Bank · Relationship Manager"
      title="Loan Review Queue"
      description="Underwriting review queue — simulated admin preview."
    >
      <BankSubNav />

      <Section title="Pending Applications">
        <AdminQueueTable
          title="Loan Applications"
          rows={adminLoanQueue.map((l) => ({
            id: l.id,
            primary: l.client,
            secondary: l.product,
            amount: l.amount,
            status: l.status,
          }))}
          showActions
        />
      </Section>
    </PageShell>
  );
}
