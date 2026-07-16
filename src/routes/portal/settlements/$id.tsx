import { createFileRoute } from "@tanstack/react-router";
import { fetchPortalSettlementDetail } from "@/lib/ncc/ncc-portal.functions";
import { PortalSettlementDetailView } from "@/components/ncc/portal/portal-settlement-detail-view";
import { PortalDetailSkeleton } from "@/components/ncc/portal/portal-skeletons";

export const Route = createFileRoute("/portal/settlements/$id")({
  loader: ({ params }) =>
    fetchPortalSettlementDetail({ data: { instructionId: params.id } }),
  pendingComponent: PortalDetailSkeleton,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.publicReference} — NCC Settlement`
          : "Settlement Detail — NCC Institution Portal",
      },
    ],
  }),
  component: PortalSettlementDetailRoute,
});

function PortalSettlementDetailRoute() {
  const detail = Route.useLoaderData();
  return <PortalSettlementDetailView detail={detail} />;
}
