import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/page-shell";
import { MerchantInvoiceDetailPanel } from "@/components/bank/merchant-invoices/merchant-invoice-detail-panel";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchMerchantInvoiceDetail } from "@/lib/bank/merchant-invoice.functions";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/bank/account/$accountId/commercial/invoices/$invoiceId")({
  loader: async ({ params }) => {
    const { context } = await fetchAccountCommercialContext({ data: params.accountId });
    const invoice = await fetchMerchantInvoiceDetail({
      data: { companyId: context.companyId, invoiceId: params.invoiceId },
    });
    return { invoice, companyId: context.companyId };
  },
  head: () => ({ meta: [{ title: "Invoice Detail — Business Account" }] }),
  component: AccountCommercialInvoiceDetailPage,
});

function AccountCommercialInvoiceDetailPage() {
  const { accountId } = Route.useParams();
  const { invoice, companyId } = Route.useLoaderData();
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <>
      <Link
        to={accountCommercialRoutes.invoices}
        params={{ accountId }}
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to all invoices
      </Link>
      <Section title={invoice.referenceCode}>
        <MerchantInvoiceDetailPanel
          invoice={invoice}
          companyId={companyId}
          accountId={accountId}
          user={user}
        />
      </Section>
    </>
  );
}
