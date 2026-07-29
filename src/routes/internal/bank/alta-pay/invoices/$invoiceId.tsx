import { createFileRoute } from "@tanstack/react-router";
import { InvoiceWorkspaceView } from "@/components/internal/workspace";
import { fetchAltaPayInvoiceAdminDetail } from "@/lib/internal/ops-platform.functions";
import { parseInvoiceRecordSearch } from "@/lib/internal/record-workspace-search";
import type { MerchantInvoiceDetail } from "@/lib/bank/merchant-invoice-types";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/alta-pay/invoices/$invoiceId")({
  validateSearch: (search: Record<string, unknown>) => parseInvoiceRecordSearch(search),
  loader: async ({ params }): Promise<{ invoice: MerchantInvoiceDetail }> => {
    const invoice = (await fetchAltaPayInvoiceAdminDetail({
      data: params.invoiceId,
    })) as MerchantInvoiceDetail;
    return { invoice };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.invoice.referenceCode ?? "Invoice"}`, (match.search as { site?: string }).site ?? "bank") }],
  }),
  component: InvoiceWorkspaceRoute,
});

function InvoiceWorkspaceRoute() {
  const { invoice } = Route.useLoaderData();
  const search = Route.useSearch();
  return <InvoiceWorkspaceView invoice={invoice} search={search} />;
}
