import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardStatementList } from "@/components/bank/alta-card/alta-card-statement-views";
import { AltaCardStatementGenerateForm } from "@/components/bank/alta-card/alta-card-statement-generate-form";
import { AltaCardBackToCardLink } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import type { AltaCardStatementRow } from "@/lib/bank/alta-card-types";

export function AltaCardStatementsPageContent({
  cardId,
  card,
  statements,
  defaultPeriod,
}: {
  cardId: string;
  card: AltaCardRow;
  statements: AltaCardStatementRow[];
  defaultPeriod: { periodStart: string; periodEnd: string };
}) {
  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Statements"
      action={<AltaCardBackToCardLink card={card} />}
    >
      <BankSubNav />

      <Section title="Generate statement" className="mb-10">
        <Card className="mx-auto max-w-xl !p-6">
          <AltaCardStatementGenerateForm cardId={cardId} defaultPeriod={defaultPeriod} card={card} />
        </Card>
      </Section>

      <Section title="Statements on file">
        <AltaCardStatementList cardId={cardId} statements={statements} card={card} />
      </Section>
    </PageShell>
  );
}
