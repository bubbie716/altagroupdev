import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { authBeforeLoad } from "@/lib/auth/guards";
import { florin } from "@/lib/bank/api";
import { fetchUserLoanApplications } from "@/lib/bank/lending.functions";
import type { LoanApplicationRow } from "@/lib/bank/lending-types";
import { formatActivityDateTime } from "@/lib/format-datetime";

export const Route = createFileRoute("/bank/lending/applications")({
  beforeLoad: authBeforeLoad,
  loader: async () => fetchUserLoanApplications(),
  head: () => ({
    meta: [{ title: "Loan Applications — Alta Bank Lending" }],
  }),
  component: BankLendingApplications,
});

function BankLendingApplications() {
  const applications = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Applications"
      description="Track submitted credit facility requests and operator review outcomes."
    >
      <BankSubNav />
      <LendingSubNav />

      {applications.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No loan applications yet.</p>
      ) : (
        <AdminDataTable
          columns={[
            {
              key: "product",
              header: "Product",
              cell: (row: LoanApplicationRow) => row.productLabel,
            },
            {
              key: "amount",
              header: "Amount",
              cell: (row: LoanApplicationRow) => (
                <span className="type-finance">{florin(row.requestedAmount)}</span>
              ),
            },
            {
              key: "term",
              header: "Term",
              cell: (row: LoanApplicationRow) => (
                <span className="type-finance">{row.termMonths} mo</span>
              ),
            },
            {
              key: "estimate",
              header: "Est. total outstanding",
              cell: (row: LoanApplicationRow) =>
                row.estimatedTotalOutstanding != null ? (
                  <span className="type-finance">{florin(row.estimatedTotalOutstanding)}</span>
                ) : (
                  "—"
                ),
            },
            {
              key: "status",
              header: "Status",
              cell: (row: LoanApplicationRow) => <StatusBadge status={row.statusLabel} />,
            },
            {
              key: "company",
              header: "Company",
              cell: (row: LoanApplicationRow) => row.companyName ?? "—",
            },
            {
              key: "submitted",
              header: "Submitted",
              cell: (row: LoanApplicationRow) => formatActivityDateTime(row.submittedAt),
            },
            {
              key: "review",
              header: "Review note",
              cell: (row: LoanApplicationRow) => (
                <span className="line-clamp-2 max-w-[240px] text-[12px] text-muted-foreground">
                  {row.reviewNote ?? "—"}
                </span>
              ),
            },
          ]}
          rows={applications}
          rowKey={(row) => row.id}
        />
      )}
    </PageShell>
  );
}
