import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { LoanDetailView } from "@/components/bank/loan-detail-view";
import { fetchLoanDetail } from "@/lib/bank/lending.functions";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";

export const Route = createFileRoute("/bank/lending/loans/$loanId")({
  loader: async ({ params }) => {
    try {
      const loan = await fetchLoanDetail({ data: params.loanId });
      return { loan };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.loan.productLabel} — Alta Bank Lending`
          : "Loan — Alta Bank Lending",
      },
    ],
  }),
  component: BankLendingLoanDetail,
});

function BankLendingLoanDetail() {
  const { loan } = Route.useLoaderData();
  const router = useRouter();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Lending"
        title={loan.productLabel}
        description={
          loan.companyName
            ? `${loan.companyName} · ${loan.statusLabel}`
            : loan.statusLabel
        }
      />
      <LoanDetailView
        loan={loan}
        onUpdated={async () => {
          await refreshMutationRouteData(router, "lending");
        }}
      />
    </>
  );
}
