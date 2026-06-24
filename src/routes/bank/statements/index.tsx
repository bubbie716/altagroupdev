import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { StatementListTable } from "@/components/bank/statement-list-table";
import { fetchStatementCenterStatements } from "@/lib/bank/statement.functions";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/statements/")({
  beforeLoad: authBeforeLoad,
  loader: () => fetchStatementCenterStatements(),
  head: () => ({
    meta: [{ title: "Account Statements — Alta Bank" }],
  }),
  component: BankStatementsPage,
});

function BankStatementsPage() {
  const statements = Route.useLoaderData();
  const personal = statements.filter((s: any) => !s.isCompanyAccount);
  const business = statements.filter((s: any) => s.isCompanyAccount);

  return (
    <PageShell
      eyebrow="Alta Bank · Statements"
      title="Statement Center"
      description="Monthly account statements for your personal and business Alta Bank accounts."
    >
      <BankSubNav />

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-border/60 bg-surface-2/40 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        <p>
          Statements are generated from approved transaction history. PDF export and automated monthly
          delivery are planned for a future release.
        </p>
      </div>

      {statements.length === 0 ? (
        <Section title="Statements">
          <Card className="!p-6">
            <StatementListTable statements={statements} />
          </Card>
        </Section>
      ) : (
        <>
          {personal.length > 0 && (
            <Section title="Personal accounts" className={business.length > 0 ? "mb-10" : undefined}>
              <Card className="!p-6">
                <StatementListTable statements={personal} />
              </Card>
            </Section>
          )}
          {business.length > 0 && (
            <Section title="Business accounts">
              <Card className="!p-6">
                <StatementListTable statements={business} />
              </Card>
            </Section>
          )}
        </>
      )}
    </PageShell>
  );
}
