import { Link, useRouter } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardApplicationDetailView } from "@/components/bank/alta-card/alta-card-application-detail";
import {
  fetchAltaCardApplicationDetail,
  fetchAltaCardApplicationThreadContext,
  fetchAltaCardApplicationThreadMessages,
} from "@/lib/bank/alta-card-application.functions";

export async function loadAltaCardApplicationPageData(applicationId: string) {
  const [application, threadContext, messages] = await Promise.all([
    fetchAltaCardApplicationDetail({ data: applicationId }),
    fetchAltaCardApplicationThreadContext({
      data: { applicationId, variant: "user" },
    }),
    fetchAltaCardApplicationThreadMessages({ data: applicationId }),
  ]);
  return { application, threadContext, messages };
}

export function AltaCardApplicationPage({
  application,
  threadContext,
  messages,
  backTo,
  backLabel,
}: Awaited<ReturnType<typeof loadAltaCardApplicationPageData>> & {
  backTo: "/bank/alta-card" | "/bank/alta-card/business";
  backLabel: string;
}) {
  const router = useRouter();

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Application"
      action={
        <Link
          to={backTo}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          {backLabel}
        </Link>
      }
    >
      <BankSubNav />
      <AltaCardApplicationDetailView
        application={application}
        threadContext={threadContext}
        messages={messages}
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
    </PageShell>
  );
}
