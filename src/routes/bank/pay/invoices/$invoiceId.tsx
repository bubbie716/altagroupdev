import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { CustomerInvoicePayPanel } from "@/components/bank/invoices/customer-invoice-pay-panel";
import {
  fetchCustomerInvoice,
  fetchPayFundingSourcesForInvoice,
} from "@/lib/bank/merchant-invoice.functions";

type InvoiceSearch = {
  action?: string;
};

export const Route = createFileRoute("/bank/pay/invoices/$invoiceId")({
  validateSearch: (search: Record<string, unknown>): InvoiceSearch => ({
    action: typeof search.action === "string" ? search.action : undefined,
  }),
  loader: async ({ params }) => {
    const [invoice, fundingSources] = await Promise.all([
      fetchCustomerInvoice({ data: params.invoiceId }),
      fetchPayFundingSourcesForInvoice({ data: params.invoiceId }),
    ]);
    return { invoice, fundingSources };
  },
  head: () => ({ meta: [{ title: "Invoice — Alta Pay" }] }),
  component: CustomerInvoicePage,
});

function CustomerInvoicePage() {
  const { invoice, fundingSources } = Route.useLoaderData();
  const { action } = Route.useSearch();

  return (
    <>
      <BankPageMeta eyebrow="Alta Bank · Alta Pay" title="Invoice" />
      <Link
        to="/bank/pay/invoices"
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to all invoices
      </Link>
      <Section title={invoice.merchantName}>
        <CustomerInvoicePayPanel
          invoice={invoice}
          fundingSources={fundingSources}
          startInPayMode={action === "pay"}
        />
      </Section>
    </>
  );
}
