import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { PaymentLinkCheckoutPanel } from "@/components/bank/payment-links/payment-link-checkout-panel";
import {
  fetchPaymentLinkCheckout,
  fetchPayFundingSourcesForCheckout,
} from "@/lib/bank/payment-link.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/pay/$slug")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    const [checkout, fundingSources] = await Promise.all([
      fetchPaymentLinkCheckout({ data: params.slug }),
      fetchPayFundingSourcesForCheckout(),
    ]);
    return { checkout, fundingSources };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Pay ${loaderData.checkout.merchantName} — Alta Bank`
          : "Checkout — Alta Bank",
      },
    ],
  }),
  component: PaymentLinkCheckoutPage,
});

function PaymentLinkCheckoutPage() {
  const { checkout, fundingSources } = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank"
      title="Checkout"
      description={`Pay ${checkout.merchantName} securely with your Alta Bank account.`}
    >
      <PaymentLinkCheckoutPanel checkout={checkout} fundingSources={fundingSources} />
    </PageShell>
  );
}
