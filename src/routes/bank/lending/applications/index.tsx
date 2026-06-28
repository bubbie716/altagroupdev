import { createFileRoute } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { fetchUserLoanApplications } from "@/lib/bank/lending.functions";
import { LendingApplicationsList } from "@/components/bank/lending-applications-list";

export const Route = createFileRoute("/bank/lending/applications/")({
  loader: async () => fetchUserLoanApplications(),
  head: () => ({
    meta: [{ title: "Loan Applications — Alta Bank Lending" }],
  }),
  component: BankLendingApplications,
});

function BankLendingApplications() {
  const applications = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Lending"
      title="Applications"
      description="Track submitted credit facility requests, review status, and Secure Deal Room communication."
     />
<LendingApplicationsList applications={applications} />
    </>
  );
}
