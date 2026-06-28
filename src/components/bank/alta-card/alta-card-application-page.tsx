import { useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardApplicationDetailView } from "@/components/bank/alta-card/alta-card-application-detail";
import { fetchAltaCardApplicationDetail } from "@/lib/bank/alta-card-application.functions";

export async function loadAltaCardApplicationPageData(applicationId: string) {
  const application = await fetchAltaCardApplicationDetail({ data: applicationId });
  return { application };
}

export function AltaCardApplicationPage({
  application,
}: Awaited<ReturnType<typeof loadAltaCardApplicationPageData>>) {
  const router = useRouter();

  return (
    <>
      <BankPageMeta eyebrow="Alta Bank · Alta Card" title="Application" />
      <AltaCardApplicationDetailView
        application={application}
        onAccepted={async () => {
          if (application.cardType === "business" && application.companyId) {
            await router.navigate({
              to: "/bank/alta-card/business/$companyId",
              params: { companyId: application.companyId },
            });
            return;
          }
          await router.invalidate();
        }}
      />
    </>
  );
}
