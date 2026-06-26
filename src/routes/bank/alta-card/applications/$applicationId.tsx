import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  AltaCardApplicationPage,
  loadAltaCardApplicationPageData,
} from "@/components/bank/alta-card/alta-card-application-page";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/alta-card/applications/$applicationId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    const data = await loadAltaCardApplicationPageData(params.applicationId);
    if (data.application.cardType === "business") {
      throw redirect({
        to: "/bank/alta-card/business/applications/$applicationId",
        params: { applicationId: params.applicationId },
      });
    }
    return data;
  },
  head: () => ({ meta: [{ title: "Alta Card Application — Alta Bank" }] }),
  component: BankAltaCardApplicationDetail,
});

function BankAltaCardApplicationDetail() {
  const data = Route.useLoaderData();

  return (
    <AltaCardApplicationPage
      {...data}
      backTo="/bank/alta-card"
      backLabel="← Alta Card"
    />
  );
}
