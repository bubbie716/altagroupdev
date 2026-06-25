import { createFileRoute } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { StatementListTable } from "@/components/bank/statement-list-table";
import { BankStatStrip } from "@/components/bank/bank-stat-strip";
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

      <BankStatStrip
        items={[
          { label: "Personal statements", value: String(personal.length) },
          { label: "Business statements", value: String(business.length) },
          { label: "Total on file", value: String(statements.length) },
        ]}
      />

      <p className="mt-3 mb-8 rounded-md border border-border bg-surface-1/60 px-4 py-3 text-[12px] text-muted-foreground">
        Statements are generated from approved transaction history.
      </p>

      {statements.length === 0 ? (
        <Section title="Statements">
          <div className="rounded-xl border border-border bg-surface-1">
            <StatementListTable statements={statements} />
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
                <StatementListTable statements={personal} />
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
                <StatementListTable statements={business} />
              </div>
            </Section>
          )}
        </>
      )}
    </PageShell>
  );
}
