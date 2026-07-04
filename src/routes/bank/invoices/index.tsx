import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { CustomerInvoicesInbox } from "@/components/bank/invoices/customer-invoices-inbox";
import { fetchReceivedInvoices } from "@/lib/bank/merchant-invoice.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/invoices/")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const invoices = await fetchReceivedInvoices();
    return { invoices };
  },
  head: () => ({ meta: [{ title: "Invoices — Alta Bank" }] }),
  component: CustomerInvoicesPage,
});

function CustomerInvoicesPage() {
  const { invoices } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta eyebrow="Alta Bank" title="Invoices" />
      <Section title="Received invoices">
        <CustomerInvoicesInbox invoices={invoices} />
      </Section>
    </>
  );
}
