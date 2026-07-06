import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { CustomerInvoicesInbox } from "@/components/bank/invoices/customer-invoices-inbox";
import { fetchReceivedInvoices } from "@/lib/bank/merchant-invoice.functions";

export const Route = createFileRoute("/bank/pay/invoices/")({
  loader: async () => {
    const invoices = await fetchReceivedInvoices();
    return { invoices };
  },
  head: () => ({ meta: [{ title: "Invoices — Alta Pay" }] }),
  component: CustomerInvoicesPage,
});

function CustomerInvoicesPage() {
  const { invoices } = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Alta Pay"
        title="Received invoices"
        description="Invoices sent to you by Alta Bank merchants."
      />
      <Section title="Received invoices">
        <CustomerInvoicesInbox invoices={invoices} />
      </Section>
    </>
  );
}
