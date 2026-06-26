import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  AltaCardApplicationPage,
  loadAltaCardApplicationPageData,
} from "@/components/bank/alta-card/alta-card-application-page";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/alta-card/business/applications/$applicationId")({
  beforeLoad: authBeforeLoad,
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
    <AltaCardApplicationPage
      {...data}
      backTo="/bank/alta-card/business"
      backLabel="← Business Alta Cards"
    />
  );
}
