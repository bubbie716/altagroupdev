import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { StatementListTable } from "@/components/bank/statement-list-table";
import { StatementCenterGenerateDialog } from "@/components/bank/statement-center-generate-form";
import {
  fetchPreviousStatementPeriod,
  fetchStatementCenterStatements,
  fetchStatementGeneratableAccounts,
} from "@/lib/bank/statement.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/statements/")({
  beforeLoad: authBeforeLoad,
  loader: async () => {
    const [statements, generatableAccounts, defaultPeriod] = await Promise.all([
      fetchStatementCenterStatements(),
      fetchStatementGeneratableAccounts(),
      fetchPreviousStatementPeriod(),
    ]);
    return { statements, generatableAccounts, defaultPeriod };
  },
  head: () => ({
    meta: [{ title: "Account Statements — Alta Bank" }],
  }),
  component: BankStatementsPage,
});

function BankStatementsPage() {
  const { statements, generatableAccounts, defaultPeriod } = Route.useLoaderData();
  const personal = statements.filter((s) => !s.isCompanyAccount);
  const business = statements.filter((s) => s.isCompanyAccount);

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Statements"
        title="Statement Center"
        description="Monthly statements generated from approved transaction history."
        action={
          <StatementCenterGenerateDialog
            accounts={generatableAccounts}
            defaultPeriod={defaultPeriod}
          />
        }
      />

      {statements.length === 0 ? (
        <Section title="Statements">
          <div className="rounded-xl border border-border bg-surface-1 p-5">
            <StatementListTable statements={statements} returnFrom="center" />
          </div>
        </Section>
      ) : (
        <div className="space-y-8">
          {personal.length > 0 ? (
            <Section
              title="Personal accounts"
              action={
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {personal.length} on file
                </span>
              }
            >
              <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
                <StatementListTable statements={personal} returnFrom="center" />
              </div>
            </Section>
          ) : null}
          {business.length > 0 ? (
            <Section
              title="Business accounts"
              action={
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {business.length} on file
                </span>
              }
            >
              <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
                <StatementListTable statements={business} returnFrom="center" />
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </>
  );
}
