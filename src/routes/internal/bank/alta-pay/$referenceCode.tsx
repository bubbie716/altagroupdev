import { createFileRoute } from "@tanstack/react-router";
import { AltaPayPaymentWorkspaceView } from "@/components/internal/workspace";
import { fetchAltaPayAdminDetail } from "@/lib/internal/ops-platform.functions";
import { parseAltaPayRecordSearch } from "@/lib/internal/record-workspace-search";
import type { AltaPayAdminRow } from "@/lib/internal/ops-types";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export const Route = createFileRoute("/internal/bank/alta-pay/$referenceCode")({
  validateSearch: (search: Record<string, unknown>) => parseAltaPayRecordSearch(search),
  loader: async ({ params }): Promise<{ payment: AltaPayAdminRow }> => {
    const payment = (await fetchAltaPayAdminDetail({
      data: params.referenceCode,
    })) as AltaPayAdminRow;
    return { payment };
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: internalDocumentTitle(`${loaderData?.payment.referenceCode ?? "Alta Pay"}`, (match.search as { site?: string }).site ?? "bank") }],
  }),
  component: AltaPayPaymentWorkspaceRoute,
});

function AltaPayPaymentWorkspaceRoute() {
  const { payment } = Route.useLoaderData();
  const search = Route.useSearch();
  return <AltaPayPaymentWorkspaceView payment={payment} search={search} />;
}
