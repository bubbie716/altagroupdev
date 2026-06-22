import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AdminQueueTable } from "@/components/bank/admin-queue-table";
import { getAdminClients } from "@/lib/bank/api";

export const Route = createFileRoute("/bank/admin/clients")({
  head: () => ({
    meta: [{ title: "Alta Bank Admin — Clients" }],
  }),
  component: AdminClients,
});

function AdminClients() {
  const adminClients = getAdminClients();

  return (
    <PageShell
      eyebrow="Alta Bank · Relationship Manager"
      title="Client Management"
      description="Relationship banking admin preview — all actions are simulated."
    >
      <BankSubNav />

      <Section title="Client Search">
        <input
          type="search"
          placeholder="Search clients by name, ID, or account…"
          className="w-full max-w-md rounded-md border border-border bg-surface-1 px-4 py-2.5 text-sm outline-none focus:border-gold/50"
          disabled
        />
      </Section>

      <Section title="Client Queue" className="mt-8">
        <AdminQueueTable
          title="Active Relationships"
          rows={adminClients.map((c) => ({
            id: c.id,
            primary: c.name,
            secondary: `${c.tier} · Private: ${c.privateInvite}`,
            amount: c.relationshipValue,
            status: c.accountStatus,
          }))}
          showActions
        />
      </Section>
    </PageShell>
  );
}
