import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  AltaCardApplicationPage,
  loadAltaCardApplicationPageData,
} from "@/components/bank/alta-card/alta-card-application-page";

export const Route = createFileRoute("/bank/alta-card/business/applications/$applicationId/")({
  loader: async ({ params }) => {
    const data = await loadAltaCardApplicationPageData(params.applicationId);
    if (data.application.cardType === "personal") {
      throw redirect({
        to: "/bank/alta-card/applications/$applicationId",
        params: { applicationId: params.applicationId },
      });
    }
    return data;
  },
  head: () => ({ meta: [{ title: "Business Alta Card Application — Alta Bank" }] }),
  component: BankBusinessAltaCardApplicationDetail,
});

function BankBusinessAltaCardApplicationDetail() {
  const data = Route.useLoaderData();

  return (
    <AltaCardApplicationPage {...data} />
  );
}
