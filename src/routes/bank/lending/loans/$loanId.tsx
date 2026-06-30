import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { LoanDetailView } from "@/components/bank/loan-detail-view";
import { fetchUserLoans } from "@/lib/bank/lending.functions";

export const Route = createFileRoute("/bank/lending/loans/$loanId")({
  loader: async ({ params }) => {
    const loans = await fetchUserLoans();
    const loan = loans.find((entry) => entry.id === params.loanId);
    if (!loan) throw notFound();
    return { loan };
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
          await router.invalidate();
        }}
      />
    </>
  );
}
