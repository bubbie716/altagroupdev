import { createFileRoute } from "@tanstack/react-router";
import { PaymentLinkWorkspaceView } from "@/components/internal/workspace";
import { fetchAltaPayPaymentLinkAdminDetail } from "@/lib/internal/ops-platform.functions";
import { parsePaymentLinkRecordSearch } from "@/lib/internal/record-workspace-search";
import type { PaymentLinkDetail } from "@/lib/bank/payment-link-types";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/alta-pay/payment-links/$linkId")({
  validateSearch: (search: Record<string, unknown>) => parsePaymentLinkRecordSearch(search),
  loader: async ({ params }): Promise<{ link: PaymentLinkDetail }> => {
    const link = (await fetchAltaPayPaymentLinkAdminDetail({
      data: params.linkId,
    })) as PaymentLinkDetail;
    return { link };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.link.referenceCode ?? "Payment link"}`, (match.search as { site?: string }).site ?? "bank") }],
  }),
  component: PaymentLinkWorkspaceRoute,
});

function PaymentLinkWorkspaceRoute() {
  const { link } = Route.useLoaderData();
  const search = Route.useSearch();
  return <PaymentLinkWorkspaceView link={link} search={search} />;
}
