import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { StatementListTable } from "@/components/bank/statement-list-table";
import { StatementGenerateForm } from "@/components/bank/statement-generate-form";
import {
  fetchAccountStatements,
  fetchPreviousStatementPeriod,
} from "@/lib/bank/statement.functions";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import { fetchUserBankAccountDetail } from "@/lib/bank/bank.functions";
import { canManageBusinessModule } from "@/lib/bank/business-account-access";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/statements")({
  loader: async ({ params }) => {
    const account = await fetchUserBankAccountDetail({ data: params.accountId });
    if (account.accountType === "business_operating") {
      await fetchBusinessAccountContextForModule({
        data: { accountId: params.accountId, module: "statements" },
      });
    }
    const [statements, defaultPeriod] = await Promise.all([
      fetchAccountStatements({ data: params.accountId }),
      fetchPreviousStatementPeriod(),
    ]);
    return { statements, defaultPeriod };
  },
  head: () => ({ meta: [{ title: "Statements — Account" }] }),
  component: AccountStatementsPage,
});

function AccountStatementsPage() {
  const { account, businessContext, isBusinessOperating } = AccountRoute.useLoaderData();
  const { statements, defaultPeriod } = Route.useLoaderData();

  const canGenerate =
    !isBusinessOperating ||
    !businessContext ||
    canManageBusinessModule(businessContext.role, "statements");

  return (
    <>
      {canGenerate && (
        <Section title="Generate statement" className="mb-10">
          <Card className="mx-auto max-w-xl !p-6">
            <StatementGenerateForm accountId={account.id} defaultPeriod={defaultPeriod} />
          </Card>
        </Section>
      )}

      <Section title="Statement history">
        <Card className="!p-6">
          <StatementListTable statements={statements} returnFrom="account" />
        </Card>
      </Section>
    </>
  );
}
