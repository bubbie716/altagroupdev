import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { StatementListTable } from "@/components/bank/statement-list-table";
import { StatementCenterGenerateForm } from "@/components/bank/statement-center-generate-form";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
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
  const personal = statements.filter((s: any) => !s.isCompanyAccount);
  const business = statements.filter((s: any) => s.isCompanyAccount);

  return (
    <PageShell
      eyebrow="Alta Bank · Statements"
      title="Statement Center"
      description="Monthly account statements for your personal and business Alta Bank accounts."
    >
      <BankSubNav />

      <BankStatStrip
        items={[
          { label: "Personal statements", value: String(personal.length) },
          { label: "Business statements", value: String(business.length) },
          { label: "Total on file", value: String(statements.length) },
        ]}
      />

      <Section title="Generate statement" className="mt-8 mb-10">
        <Card className="mx-auto max-w-xl !p-6">
          <StatementCenterGenerateForm accounts={generatableAccounts} defaultPeriod={defaultPeriod} />
        </Card>
      </Section>

      <p className="mb-8 rounded-md border border-border bg-surface-1/60 px-4 py-3 text-[12px] text-muted-foreground">
        Statements are generated from approved transaction history.
      </p>

      {statements.length === 0 ? (
        <Section title="Statements">
          <div className="rounded-xl border border-border bg-surface-1">
            <StatementListTable statements={statements} returnFrom="center" />
          </div>
        </Section>
      ) : (
        <>
          {personal.length > 0 && (
            <Section
              title="Personal accounts"
              className={business.length > 0 ? "mb-10" : undefined}
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
          )}
          {business.length > 0 && (
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
          )}
        </>
      )}
    </PageShell>
  );
}
