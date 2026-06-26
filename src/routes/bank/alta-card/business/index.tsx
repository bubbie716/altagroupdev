import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardBusinessCompanyList } from "@/components/bank/alta-card/alta-card-business-panel";
import { AltaCardEmployeeCardList } from "@/components/bank/alta-card/alta-card-employee-card-panel";
import { AltaCardPendingApplicationBanner } from "@/components/bank/alta-card/alta-card-landing-hero";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchBusinessAltaCardHub } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/business/")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchBusinessAltaCardHub(),
  head: () => ({
    meta: [{ title: "Business Alta Cards — Alta Bank" }],
  }),
  component: BankAltaCardBusinessIndex,
});

function BankAltaCardBusinessIndex() {
  const { companies, employeeCards } = Route.useLoaderData();
  const pendingApplications = companies
    .map((c) => c.pendingApplication)
    .filter((application): application is NonNullable<typeof application> => application != null);
  const hasOpenApplySlot = companies.some((c) => !c.businessCard && !c.pendingApplication);
  const hasTreasuryCompanies = companies.length > 0;
  const hasEmployeeCards = employeeCards.length > 0;

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Business Alta Cards"
      description="Company revolving credit lines and employee cards authorized against your business limit."
      action={
        hasOpenApplySlot ? (
          <Link
            to="/bank/alta-card/business/apply"
            className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background hover:bg-foreground/90"
          >
            Apply for business card
          </Link>
        ) : null
      }
    >
      <BankSubNav />

      {pendingApplications.length > 0 ? (
        <div className="mb-8 space-y-4">
          {pendingApplications.map((application) => (
            <AltaCardPendingApplicationBanner
              key={application.id}
              statusLabel={ALTA_CARD_APPLICATION_STATUS_LABELS[application.status]}
              applicationId={application.id}
              cardType="business"
              status={application.status}
              companyName={application.companyName}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-10">
        {hasEmployeeCards ? <AltaCardEmployeeCardList cards={employeeCards} /> : null}

        {hasTreasuryCompanies ? (
          <section className="space-y-4">
            {hasEmployeeCards ? (
              <div>
                <h3 className="font-serif text-[20px]">Company cards you manage</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Business credit lines where you have owner or finance manager access.
                </p>
              </div>
            ) : null}
            <AltaCardBusinessCompanyList companies={companies} />
          </section>
        ) : hasEmployeeCards ? null : (
          <p className="text-[14px] text-muted-foreground">
            No business cards on file yet. If your company has a line, an owner or finance manager can
            issue you an employee card. Companies with treasury access can apply for a business Alta Card
            here.
          </p>
        )}
      </div>
    </PageShell>
  );
}
