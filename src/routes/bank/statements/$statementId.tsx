import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { StatementDocument } from "@/components/bank/statement-document";
import { fetchStatementDetail } from "@/lib/bank/statement.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/statements/$statementId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => {
    try {
      return await fetchStatementDetail({ data: params.statementId });
    } catch {
      throw redirect({ to: "/bank/statements" });
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.statementNumber ?? "Statement"} — Alta Bank` }],
  }),
  component: StatementDetailPage,
});

function StatementDetailPage() {
  const statement = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Bank · Statement"
      title={statement.statementNumber}
      description={`${statement.accountName} · ${statement.accountNumber}`}
      printDocument
      hideFooter
    >
      <BankSubNav className="print:hidden" />
      <StatementDocument
        statement={statement}
        backTo={{
          to: "/bank/account/$accountId/statements",
          params: { accountId: statement.bankAccountId },
        }}
      />
    </PageShell>
  );
}
