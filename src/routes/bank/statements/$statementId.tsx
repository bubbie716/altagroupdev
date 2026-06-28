import { createFileRoute, redirect } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { StatementDocument } from "@/components/bank/statement-document";
import { fetchStatementDetail } from "@/lib/bank/statement.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

type StatementDetailSearch = {
  from?: "account" | "center";
};

export const Route = createFileRoute("/bank/statements/$statementId")({
  beforeLoad: authBeforeLoad,
  validateSearch: (search: Record<string, unknown>): StatementDetailSearch => ({
    from: search.from === "center" ? "center" : "account",
  }),
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
  const { from } = Route.useSearch();

  const backTo =
    from === "center"
      ? {
          to: "/bank/statements/",
          label: "Back to all statements",
        }
      : {
          to: "/bank/account/$accountId/statements",
          params: { accountId: statement.bankAccountId },
          label: "Back to account",
        };

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Statement"
      title={statement.statementNumber}
      description={`${statement.accountName} · ${statement.accountNumber}`}
      printDocument
      hideFooter
     />
<StatementDocument statement={statement} backTo={backTo} />
    </>
  );
}
