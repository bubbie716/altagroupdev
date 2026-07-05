import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Section } from "@/components/page-shell";
import { PaymentLinkForm } from "@/components/bank/payment-links/payment-link-form";
import { fetchAccountCommercialContext } from "@/lib/bank/account-commercial-loader.functions";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import { fetchCommercialReceivableCreationLimits } from "@/lib/bank/commercial-banking.functions";

export const Route = createFileRoute("/bank/account/$accountId/commercial/payment-links/new")({
  loader: async ({ params }) => {
    const { context } = await fetchAccountCommercialContext({ data: params.accountId });
    const limits = await fetchCommercialReceivableCreationLimits({ data: context.companyId });
    if (!limits.canCreatePaymentLink) {
      throw redirect({
        to: accountCommercialRoutes.paymentLinks,
        params: { accountId: params.accountId },
      });
    }
    return { companyId: context.companyId };
  },
  head: () => ({ meta: [{ title: "New Payment Link — Business Account" }] }),
  component: AccountCommercialNewPaymentLinkPage,
});

function AccountCommercialNewPaymentLinkPage() {
  const { accountId } = Route.useParams();
  const { companyId } = Route.useLoaderData();

  return (
    <>
      <Link
        to={accountCommercialRoutes.paymentLinks}
        params={{ accountId }}
        className="-ml-1 mb-6 inline-flex items-center gap-1.5 rounded-md px-1 py-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        Back to all payment links
      </Link>
      <Section title="Create payment link">
        <PaymentLinkForm companyId={companyId} accountId={accountId} />
      </Section>
    </>
  );
}
